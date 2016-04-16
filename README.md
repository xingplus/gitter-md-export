# Gitter MD export App

A simple way to export the chat history of a room as markdown. Very crude as simple a quick hack based on the official [gitter-demo-app](https://github.com/gitterHQ/gitter-demo-app).

## HOWTO

1. Create a new app at [https://developer.gitter.im](https://developer.gitter.im). The ```Redirect URL``` should be ```http://localhost:7000/login/callback```
2. Run npm install
3. Launch the demo app with:

```
$ GITTER_KEY=<your-app-key> GITTER_SECRET=<your-app-secret> node app.js
```

Happy Hacking!
