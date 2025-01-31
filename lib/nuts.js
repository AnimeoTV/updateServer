var _ = require("lodash")
var Q = require("q")
var Feed = require("feed")
var urljoin = require("urljoin.js")
var url = require("url")
var Understudy = require("understudy")
var express = require("express")
var useragent = require("express-useragent")
var createError = require("http-errors")

var BACKENDS = require("./backends")
var Versions = require("./versions")
var notes = require("./utils/notes")
var platforms = require("./utils/platforms")
var winReleases = require("./utils/win-releases")
var API_METHODS = require("./api")

function getFullUrl(req) {
  return req.protocol + "://" + req.get("host") + req.originalUrl
}

function Nuts(opts) {
  if (!(this instanceof Nuts)) return new Nuts(opts)
  var that = this

  Understudy.call(this)
  _.bindAll(this, _.functions(this))

  this.opts = _.defaults(opts || {}, {
    // Backend to use
    backend: "github",

    // Timeout for releases cache (seconds)
    timeout: 60 * 60 * 1000,

    // Pre-fetch list of releases at startup
    preFetch: true,

    // Secret for GitHub webhook
    refreshSecret: "secret",

    // Prefix for all routes
    routePrefix: "/",

    // Authenticator for non-api endpoints
    authHandler: undefined,
  })

  if (
    this.opts.routePrefix.substr(this.opts.routePrefix.length - 1, 1) !== "/"
  ) {
    throw new Error("ROUTE_PREIX must end with a slash")
  }

  // .init() is now a memoized version of ._init()
  this.init = _.memoize(this._init)

  // Create router
  this.router = express.Router()

  // Create backend
  this.backend = new (BACKENDS(this.opts.backend))(this, this.opts)
  this.versions = new Versions(this.backend, this.opts.maxVersion)

  // Bind routes
  this.router.use(useragent.express())

  const withPrefix = (s) => `${that.opts.routePrefix}${s}`

  const onDownload = this._onDownload.bind(this)

  this.router.get(withPrefix(""), onDownload)
  this.router.get(
    withPrefix(`download/channel/:channel/:platform?`),
    onDownload,
  )
  this.router.get(withPrefix(`download/version/:tag/:platform?`), onDownload)

  this.router.get(withPrefix(`download/:tag/:filename`), onDownload)
  this.router.get(withPrefix(`download/:platform?`), onDownload)

  this.router.get(
    withPrefix(`feed/channel/:channel.atom`),
    this.onServeVersionsFeed.bind(this),
  )

  this.router.get(withPrefix(`update`), this.onUpdateRedirect.bind(this))
  this.router.get(
    withPrefix(`update/:platform/:version`),
    this.onUpdate.bind(this),
  )
  this.router.get(
    withPrefix(`update/channel/:channel/:platform/:version`),
    this.onUpdate.bind(this),
  )
  this.router.get(
    withPrefix(`update/:platform/:version/RELEASES`),
    this.onUpdateWin.bind(this),
  )
  this.router.get(
    withPrefix(`update/channel/:channel/:platform/:version/RELEASES`),
    this.onUpdateWin.bind(this),
  )

  this.router.get(withPrefix(`notes/:version?`), this.onServeNotes.bind(this))

  // Bind API
  this.router.use(withPrefix(`api`), this.onAPIAccessControl.bind(this))
  _.each(API_METHODS, (method, route) => {
    that.router.get(withPrefix(`api/${route}`), (req, res, next) => {
      return Q()
        .then(() => {
          return method.call(that, req)
        })
        .then((result) => {
          res.send(result)
        }, next)
    })
  })
}

// _init does the real init work, initializing backend and prefetching versions
Nuts.prototype._init = function () {
  var that = this
  return Q()
    .then(function () {
      return that.backend.init()
    })
    .then(function () {
      if (!that.opts.preFetch) return
      return that.versions.list()
    })
}

Nuts.prototype.checkAuth = async function (req, version) {
  if (!this.opts.authHandler) return true

  return await this.opts.authHandler(req, version)
}

// Perform a hook using promised functions
Nuts.prototype.performQ = function (name, arg, fn) {
  var that = this
  fn = fn || function () {}

  return Q.nfcall(this.perform, name, arg, function (next) {
    Q()
      .then(function () {
        return fn.call(that, arg)
      })
      .then(function () {
        next()
      }, next)
  })
}

// Serve an asset to the response
Nuts.prototype.serveAsset = function (req, res, version, asset) {
  var that = this

  return that.init().then(function () {
    return that.performQ(
      "download",
      {
        req: req,
        version: version,
        platform: asset,
      },
      function () {
        return that.backend.serveAsset(asset, req, res)
      },
    )
  })
}

// Handler for download routes
Nuts.prototype._onDownload = function (req, res, next) {
  var that = this
  // If specific version, don't enforce a channel
  var platform = req.params.platform
  var tag = req.params.tag || "latest"
  var channel = tag != "latest" ? "*" : req.params.channel
  var filename = req.params.filename
  var filetypeWanted = req.query.filetype

  // When serving a specific file, platform is not required
  if (!filename) {
    // Detect platform from useragent
    if (!platform) {
      platform = platforms.detectPlatformByUserAgent(req.useragent)
    }
    if (!platform) {
      res.status(400).send("No platform specified and impossible to detect one")
      return
    }
  } else {
    platform = null
  }

  this.versions
    .resolve({
      channel: channel,
      platform: platform,
      tag: tag,
    })

    // Fallback to any channels if no version found on stable one
    .catch(function (err) {
      if (channel || tag != "latest") throw err

      return that.versions.resolve({
        channel: "*",
        platform: platform,
        tag: tag,
      })
    })

    // Serve downloads
    .then(async function (version) {
      if (!(await that.checkAuth(req, version))) return res.sendStatus(403)

      var asset

      if (filename) {
        asset = _.find(version.platforms, {
          filename: filename,
        })
      } else {
        asset = platforms.resolve(version, platform, {
          wanted: filetypeWanted ? "." + filetypeWanted : null,
        })
      }

      if (!asset) {
        res
          .status(404)
          .send(
            "No download available for platform " +
              _.escape(platform) +
              " for version " +
              version.tag +
              " (" +
              (channel || "beta") +
              ")",
          )
        return
      }

      // Call analytic middleware, then serve
      return that.serveAsset(req, res, version, asset)
    })
    .catch(function () {
      res.status(404).send("No download available for platform " + platform)
    })
}

// Request to update
Nuts.prototype.onUpdateRedirect = function (req, res, next) {
  var that = this

  Q()
    .then(function () {
      if (!req.query.version) throw new Error('Requires "version" parameter')
      if (!req.query.platform) throw new Error('Requires "platform" parameter')

      return res.redirect(
        `${that.opts.routePrefix}update/${_.escape(req.query.platform)}/${
          req.query.version
        }`,
      )
    })
    .catch(next)
}

// Updater used by OSX (Squirrel.Mac) and others
Nuts.prototype.onUpdate = function (req, res, next) {
  var that = this
  var fullUrl = getFullUrl(req)
  var platform = req.params.platform
  var channel = req.params.channel || "stable"
  var tag = req.params.version
  var filetype = req.query.filetype ? req.query.filetype : "zip"

  Q()
    .then(function () {
      if (!tag) throw createError(400, 'Requires "version" parameter')
      if (!platform) throw createError(400, 'Requires "platform" parameter')

      platform = platforms.detect(platform)

      return that.versions.filter({
        tag: ">=" + tag,
        platform: platform,
        channel: channel,
        stripChannel: true,
      })
    })
    .then(async function (versions) {
      var latest = versions[0]

      // Already using latest version?
      if (!latest || latest.tag == tag)
        return res.status(204).send("No updates")

      if (!(await that.checkAuth(req, latest))) return res.sendStatus(403)

      // Extract release notes from all versions in range
      var notesSlice =
        versions.length === 1 ? [versions[0]] : versions.slice(0, -1)
      var releaseNotes = notes.merge(notesSlice, { includeTag: false })

      // URL for download should be absolute
      var gitFilePath = req.params.channel ? "/../../../../../" : "/../../../"

      res.status(200).send({
        url: urljoin(
          fullUrl,
          gitFilePath,
          "/download/version/" +
            latest.tag +
            "/" +
            platform +
            "?filetype=" +
            filetype,
        ),
        name: latest.tag,
        notes: releaseNotes,
        pub_date: latest.published_at.toISOString(),
      })
    })
    .catch(next)
}

// Update Windows (Squirrel.Windows)
// Auto-updates: Squirrel.Windows: serve RELEASES from latest version
// Currently, it will only serve a full.nupkg of the latest release with a normalized filename (for pre-release)
Nuts.prototype.onUpdateWin = function (req, res, next) {
  var that = this

  var fullUrl = getFullUrl(req)
  var platform = "win_64"
  var channel = req.params.channel || "*"
  var tag = req.params.version

  that
    .init()
    .then(function () {
      platform = platforms.detect(platform)

      return that.versions.filter({
        tag: ">=" + tag,
        platform: platform,
        channel: channel,
      })
    })
    .then(async function (versions) {
      // Update needed?
      var latest = _.first(versions)
      if (!latest) throw new Error("Version not found")

      if (!(await that.checkAuth(req, latest))) return res.sendStatus(403)

      // File exists
      var asset = _.find(latest.platforms, {
        filename: "RELEASES",
      })
      if (!asset) throw new Error("File not found")

      return that.backend.readAsset(asset).then(function (content) {
        var releases = winReleases.parse(content.toString("utf-8"))

        releases = _.chain(releases)

          // Change filename to use download proxy
          .map(function (entry) {
            var gitFilePath =
              channel === "*" ? "../../../../" : "../../../../../../"
            entry.filename = urljoin(
              fullUrl.replace(url.parse(fullUrl).search, ""),
              gitFilePath,
              "/download/" + entry.semver + "/" + entry.filename,
            )

            return entry
          })

          .value()

        var output = winReleases.generate(releases)

        res.header("Content-Length", output.length)
        res.attachment("RELEASES")
        res.send(output)
      })
    })
    .catch(next)
}

// Serve releases notes
Nuts.prototype.onServeNotes = function (req, res, next) {
  var that = this
  var tag = req.params.version

  Q()
    .then(function () {
      return that.versions.filter({
        tag: tag ? ">=" + tag : "*",
        channel: "*",
      })
    })
    .then(async function (versions) {
      var latest = _.first(versions)

      if (!latest) throw new Error("No versions matching")

      if (!(await that.checkAuth(req, latest))) return res.sendStatus(403)

      res.format({
        "application/json": function () {
          res.send({
            notes: notes.merge(versions, { includeTag: false }),
            pub_date: latest.published_at.toISOString(),
          })
        },
        default: function () {
          res.send(notes.merge(versions))
        },
      })
    })
    .catch(next)
}

// Serve versions list as RSS
Nuts.prototype.onServeVersionsFeed = function (req, res, next) {
  var that = this
  var channel = req.params.channel || "all"
  var channelId = channel === "all" ? "*" : channel
  var fullUrl = getFullUrl(req)

  var feed = new Feed({
    id: "versions/channels/" + channel,
    title: "Versions (" + channel + ")",
    link: fullUrl,
  })

  Q()
    .then(function () {
      return that.versions.filter({
        channel: channelId,
      })
    })
    .then(function (versions) {
      _.each(versions, async function (version) {
        if (await that.checkAuth(req, version)) {
          feed.addItem({
            title: version.tag,
            link: urljoin(
              fullUrl,
              "/../../../",
              `download/version/${version.tag}`,
            ),
            description: version.notes,
            date: version.published_at,
            author: [],
          })
        }
      })

      res.set("Content-Type", "application/atom+xml; charset=utf-8")
      res.send(feed.render("atom-1.0"))
    })
    .catch(next)
}

// Control access to the API
Nuts.prototype.onAPIAccessControl = function (req, res, next) {
  this.performQ("api", {
    req: req,
    res: res,
  }).then(function () {
    next()
  }, next)
}

module.exports = Nuts
