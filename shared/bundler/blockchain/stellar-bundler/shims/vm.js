// VM shim for browser compatibility
export default {
  runInThisContext: function(code) {
    return eval(code);
  },
  runInNewContext: function(code, context) {
    return eval(code);
  },
  Script: function() {}
};

// For CommonJS compatibility
if (typeof module === 'undefined') {
  window.module = { exports: {} };
}
