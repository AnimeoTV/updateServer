# Deployment

Nuts can easily be deployed to a state-less server or PaaS. It only uses the disk as a cache for assets.

### On Heroku:

Heroku is the perfect solution to host a Nuts instance.

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

### With docker

Nuts can also be run as a Docker container:

```
docker run -it -p 80:80 -e GITHUB_REPO=username/repo gitbook/nuts
```

### On your own server:

Install dependencies using:

```
$ npm install
```

The service requires to be configured using environment variables: you'll need to copy the .env.example file to .env and fill the variables.

Then start the application using:

```
$ npm start
```
