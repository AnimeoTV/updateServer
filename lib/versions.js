var _ = require("lodash")
var semver = require("semver")
var createError = require("http-errors")

var platforms = require("./utils/platforms")

// Normalize tag name
function normalizeTag(tag) {
  if (tag[0] == "v") tag = tag.slice(1)
  return tag
}

// Extract channel of version
function extractChannel(tag) {
  var suffix = tag.split("-")[1]
  if (!suffix) return "stable"

  return suffix.split(".")[0]
}

// Strip channel from a tag name
function stripChannel(tag) {
  return tag.split("-")[0]
}

// Normalize a release to a version
function normalizeVersion(release) {
  // Ignore draft
  if (release.draft) return null

  var downloadCount = 0
  var releasePlatforms = _.chain(release.assets)
    .map(function (asset) {
      var platform = platforms.detect(asset.name)
      if (!platform) return null

      downloadCount = downloadCount + asset.download_count
      return {
        id: String(asset.id),
        type: platform,
        filename: asset.name,
        size: asset.size,
        content_type: asset.content_type,
        raw: asset,
      }
    })
    .compact()
    .value()

  return {
    tag: normalizeTag(release.tag_name),
    channel: extractChannel(release.tag_name),
    notes: release.body || "",
    published_at: new Date(release.published_at),
    platforms: releasePlatforms,
  }
}

// Compare two version
function compareVersions(v1, v2) {
  if (semver.gt(v1.tag, v2.tag)) {
    return -1
  }
  if (semver.lt(v1.tag, v2.tag)) {
    return 1
  }
  return 0
}

function Versions(backend, maxVersion) {
  this.backend = backend

  this.maxVersion = null
  if (maxVersion) {
    this.maxVersion = normalizeTag(maxVersion)
  }
}

// List versions normalized
Versions.prototype.list = function () {
  var maxVersion = this.maxVersion
  return this.backend.releases().then(function (releases) {
    return _.chain(releases)
      .map(normalizeVersion)
      .compact()
      .filter(function (version) {
        return !maxVersion || semver.lte(version.tag, maxVersion)
      })
      .sort(compareVersions)
      .value()
  })
}

//  Get a specific version by its tag
Versions.prototype.get = function (tag) {
  return this.resolve({
    tag: tag,
  })
}

// Filter versions with criterias
Versions.prototype.filter = function (opts) {
  opts = _.defaults(opts || {}, {
    tag: "latest",
    platform: null,
    stripChannel: false,
    channel: "stable",
  })
  if (opts.platform) opts.platform = platforms.detect(opts.platform)

  return this.list().then(function (versions) {
    return _.chain(versions)
      .filter(function (version) {
        // Check channel
        if (opts.channel != "*" && version.channel != opts.channel) return false

        // Not available for requested platform
        if (
          opts.platform &&
          !platforms.satisfies(opts.platform, _.map(version.platforms, "type"))
        )
          return false

        // Check tag satisfies request version
        var tagName = version.tag
        if (opts.stripChannel) {
          tagName = stripChannel(tagName)
        }

        return opts.tag == "latest" || semver.satisfies(tagName, opts.tag)
      })
      .value()
  })
}

// Resolve a platform, by filtering then taking the first result
Versions.prototype.resolve = function (opts) {
  return this.filter(opts).then(function (versions) {
    var version = _.first(versions)
    if (!version) throw createError(404, "Version not found: " + opts.tag)

    return version
  })
}

// List all channels from releases
Versions.prototype.channels = function () {
  return this.list().then(function (versions) {
    var channels = {}

    _.each(versions, function (version) {
      if (!channels[version.channel]) {
        channels[version.channel] = {
          latest: null,
          versions_count: 0,
          published_at: 0,
        }
      }

      channels[version.channel].versions_count += 1
      if (channels[version.channel].published_at < version.published_at) {
        channels[version.channel].latest = version.tag
        channels[version.channel].published_at = version.published_at
      }
    })

    return channels
  })
}

module.exports = Versions
