'use strict';

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');

const config = require('./guanyu/config');
const file_max_size = config.get('FILE:MAX_SIZE');
const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));

app.use(bodyParser.json({limit: file_max_size}));
app.use(bodyParser.urlencoded({limit: file_max_size, extended: false}));

// app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  let tokens = config.get('api-tokens');
  if (req.method == 'POST' && tokens) {
    let token_set = new Set(tokens);
    if (!token_set.has(req.headers['api-token'])) {
      let err = new Error('Forbidden');
      err.status = 403;

      return next(err);
    }
  }

  next();
});

app.use('/', require('./guanyu/routes/index'));
app.use('/scan', require('./guanyu/routes/scan'));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
// no stacktrace for production
app.use((err, req, res) => {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: (app.get('env') === 'development') ? err.error : '',
  });
});

module.exports = app;
