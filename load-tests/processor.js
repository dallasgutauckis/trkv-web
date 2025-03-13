module.exports = {
  setAuthHeader,
  $randomString,
  $randomNumber,
};

function setAuthHeader(requestParams, context, ee, next) {
  if (context.vars.token) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers.Authorization = `Bearer ${context.vars.token}`;
  }
  return next();
}

function $randomString(context, events, done) {
  const length = 10;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return done(null, result);
}

function $randomNumber(context, events, done) {
  const min = arguments[3] || 1;
  const max = arguments[4] || 1000;
  const result = Math.floor(Math.random() * (max - min + 1)) + min;
  return done(null, result);
} 