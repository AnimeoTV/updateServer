# Nuts

Nuts is a simple (and smart) application to serve desktop-application releases.

![Schema](./docs/schema.png)

It uses GitHub and S3 as a backend to store assets, and it can easily be deployed as a stateless service. It supports GitHub private repositories (useful to store releases of a closed-source application available on GitHub).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

#### Features

- :sparkles: Store assets on GitHub and S3 releases
- :sparkles: Proxy releases from private repositories to your users
- :sparkles: Simple but powerful download urls
    - `/download/latest`
    - `/download/latest/:os`
    - `/download/:version`
    - `/download/:version/:os`
    - `/download/channel/:channel`
    - `/download/channel/:channel/:os`
- :sparkles: Support pre-release channels (`beta`, `alpha`, ...)
- :sparkles: Auto-updates with [Squirrel](https://github.com/Squirrel)
    - For Mac using `/update?version=<x.x.x>&platform=osx`
    - For Windows using Squirrel.Windows and Nugets packages
- :sparkles: Private API
- :sparkles: Use it as a middleware: add custom analytics, authentication
- :sparkles: Serve the perfect type of assets: `.zip` for Squirrel.Mac, `.nupkg` for Squirrel.Windows, `.dmg` for Mac users, ...
- :sparkles: Release notes endpoint
    - `/notes/:version`
- :sparkles: Up-to-date releases (GitHub webhooks)
- :sparkles: Atom/RSS feeds for versions/channels

#### Deploy it / Start it

[Follow our guide to deploy Nuts](docs/deploy.md).


#### Auto-updater / Squirrel

This server provides an endpoint for [Squirrel auto-updater](https://github.com/atom/electron/blob/master/docs/api/auto-updater.md), it supports both [OS X](docs/update-osx.md) and [Windows](docs/update-windows.md).

#### Documentation

[Check out the documentation](docs/README.md) for more details.
