var express = require("express")
var uuid = require("uuid")
var basicAuth = require("basic-auth")
var Analytics = require("analytics-node")
var nuts = require("../")
var fs = require("fs")
var https = require("https")
require("dotenv").config()

var app = express()

var apiAuth = {
  username: process.env.API_USERNAME,
  password: process.env.API_PASSWORD,
}

var analytics = undefined
var downloadEvent = process.env.ANALYTICS_EVENT_DOWNLOAD || "download"
if (process.env.ANALYTICS_TOKEN) {
  analytics = new Analytics(process.env.ANALYTICS_TOKEN)
}

// Set up for https termination
var key = "",
  cert = ""

if (process.env.HTTPS_KEYFILE !== undefined) {
  try {
    key = fs.readFileSync(process.env.HTTPS_KEYFILE)
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log("Key file not found!")
    } else {
      throw e
    }
  }
}
if (process.env.HTTPS_CERTFILE !== undefined) {
  try {
    cert = fs.readFileSync(process.env.HTTPS_CERTFILE)
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log("Certificate file not found!")
    } else {
      throw e
    }
  }
}
var https_options = {
  key: key,
  cert: cert,
}

var myNuts = nuts.Nuts({
  backend: process.env.NUTS_BACKEND,
  routePrefix: process.env.ROUTE_PREFIX,
  repository: process.env.GITHUB_REPO,
  token: process.env.GITHUB_TOKEN,
  endpoint: process.env.GITHUB_ENDPOINT,
  username: process.env.GITHUB_USERNAME,
  password: process.env.GITHUB_PASSWORD,
  credentials: {
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  configuration: {
    aws: {
      bucket: process.env.AWS_BUCKET,
      releasesPrefix: process.env.AWS_RELEASES_PREFIX,
    },
  },
  timeout: process.env.VERSIONS_TIMEOUT,
  cache: process.env.VERSIONS_CACHE,
  refreshSecret: process.env.GITHUB_SECRET,
  maxVersion: process.env.NUTS_MAX_VERSION,
  proxyAssets: process.env.DONT_PROXY_ASSETS !== "true",
})

// Control access to API
myNuts.before("api", function (access, next) {
  if (!apiAuth.username) return next()

  function unauthorized() {
    next(new Error("Invalid username/password for API"))
  }

  var user = basicAuth(access.req)
  if (!user || !user.name || !user.pass) {
    return unauthorized()
  }

  if (user.name === apiAuth.username && user.pass === apiAuth.password) {
    return next()
  } else {
    return unauthorized()
  }
})

// Log download
myNuts.before("download", function (download, next) {
  console.log(
    `download ${download.platform.filename} for version ${download.version.tag} on channel ${download.version.channel} for ${download.platform.type}`,
  )

  next()
})
myNuts.after("download", function (download, next) {
  console.log(
    `downloaded ${download.platform.filename} for version ${download.version.tag} on channel ${download.version.channel} for ${download.platform.type}`,
  )

  // Track on segment if enabled
  if (analytics) {
    var userId = download.req.query.user

    analytics.track({
      event: downloadEvent,
      anonymousId: userId ? null : uuid.v4(),
      userId: userId,
      properties: {
        version: download.version.tag,
        channel: download.version.channel,
        platform: download.platform.type,
        os: nuts.platforms.toType(download.platform.type),
      },
    })
  }

  next()
})

if (process.env.TRUST_PROXY) {
  try {
    var trustProxyObject = JSON.parse(process.env.TRUST_PROXY)
    app.set("trust proxy", trustProxyObject)
  } catch (e) {
    app.set("trust proxy", process.env.TRUST_PROXY)
  }
}

app.use(myNuts.router)

// Error handling
app.use(function (req, res, next) {
  res.status(404).send("Page not found")
})
app.use(function (err, req, res, next) {
  const msg = err.message || err

  console.error(err.stack || err)

  // Return error
  res.format({
    "text/plain": function () {
      res.status(500).send(msg)
    },
    "text/html": function () {
      res.status(500).send(msg)
    },
    "application/json": function () {
      res.status(500).send({
        error: msg,
        code: 500,
      })
    },
  })
})

myNuts
  .init()

  // Start the HTTP and/or HTTPS server
  .then(
    function () {
      // Enable https endpoint if key and cert are set
      if (key != "" && cert != "") {
        var https_server = https
          .createServer(https_options, app)
          .listen(process.env.HTTPSPORT || 5001, function () {
            var hosts = https_server.address().address
            var ports = https_server.address().port

            console.log("Listening at https://%s:%s", hosts, ports)
          })
      }

      var server = app.listen(process.env.PORT || 5000, function () {
        var host = server.address().address
        var port = server.address().port

        console.log(`Listening at http://${host}:${port}`)
      })
    },
    function (err) {
      console.log(err.stack || err)
      process.exit(1)
    },
  )
