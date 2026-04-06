(function () {
  "use strict";

  var pendingRequests = new Map();
  var nextId = 0;
  var themeListeners = [];

  function request(method, args) {
    return new Promise(function (resolve, reject) {
      var id = "b_" + ++nextId;
      pendingRequests.set(id, { resolve: resolve, reject: reject });
      parent.postMessage(
        { type: "goose:bridge", id: id, method: method, args: args || [] },
        "*"
      );
    });
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme.variables) {
      var keys = Object.keys(theme.variables);
      for (var i = 0; i < keys.length; i++) {
        root.style.setProperty(keys[i], theme.variables[keys[i]]);
      }
    }
    if (theme.mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = theme.mode || "light";
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "goose:response") {
      var pending = pendingRequests.get(data.id);
      if (pending) {
        pendingRequests.delete(data.id);
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.result);
        }
      }
      return;
    }

    if (data.type === "goose:theme") {
      applyTheme(data.theme);
      for (var i = 0; i < themeListeners.length; i++) {
        try {
          themeListeners[i](data.theme);
        } catch (_) {}
      }
    }
  });

  window.goose = {
    theme: {
      get mode() {
        return document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
      },
      get accent() {
        return (
          getComputedStyle(document.documentElement)
            .getPropertyValue("--color-brand")
            .trim() || "#3b82f6"
        );
      },
      get density() {
        var val =
          getComputedStyle(document.documentElement)
            .getPropertyValue("--density-spacing")
            .trim() || "1";
        if (val === "0.75") return "compact";
        if (val === "1.25") return "spacious";
        return "comfortable";
      },
      onChange: function (callback) {
        themeListeners.push(callback);
      },
    },

    git: {
      getState: function () {
        return request("git.getState");
      },
    },

    shell: {
      run: function (command, options) {
        return request("shell.run", [command, options]);
      },
    },

    chat: {
      send: function (message) {
        return request("chat.send", [message]);
      },
    },

    storage: {
      get: function (key) {
        return request("storage.get", [key]);
      },
      set: function (key, value) {
        return request("storage.set", [key, value]);
      },
      remove: function (key) {
        return request("storage.remove", [key]);
      },
      clear: function () {
        return request("storage.clear");
      },
    },

    widget: {
      setTitle: function (title) {
        parent.postMessage(
          { type: "goose:widget", action: "setTitle", title: title },
          "*"
        );
      },
      close: function () {
        parent.postMessage({ type: "goose:widget", action: "close" }, "*");
      },
    },
  };

  var lastHeight = 0;
  function reportHeight() {
    var h = document.documentElement.scrollHeight;
    if (h !== lastHeight) {
      lastHeight = h;
      parent.postMessage({ type: "goose:resize", height: h }, "*");
    }
  }

  var ro = new ResizeObserver(reportHeight);
  if (document.body) {
    ro.observe(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      ro.observe(document.body);
    });
  }

  parent.postMessage({ type: "goose:ready" }, "*");
  reportHeight();
})();
