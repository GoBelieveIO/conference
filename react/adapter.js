
var webrtcUtils = {
    log: function() {
        // suppress console.log output when being included as a module.
        //if (typeof module !== 'undefined' ||
        //    typeof require === 'function' && typeof define === 'function') {
        //    return;
        //}
        console.log.apply(console, arguments);
    },
    extractVersion: function(uastring, expr, pos) {
        var match = uastring.match(expr);
        return match && match.length >= pos && parseInt(match[pos], 10);
    }
};

{
    // The RTCPeerConnection object.
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        // Translate iceTransportPolicy to iceTransports,
        // see https://code.google.com/p/webrtc/issues/detail?id=4869
        if (pcConfig && pcConfig.iceTransportPolicy) {
            pcConfig.iceTransports = pcConfig.iceTransportPolicy;
        }

        var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
        var origGetStats = pc.getStats.bind(pc);
        pc.getStats = function(selector, successCallback, errorCallback) { // jshint ignore: line
            var self = this;
            var args = arguments;

            // If selector is a function then we are in the old style stats so just
            // pass back the original getStats format to avoid breaking old users.
            if (arguments.length > 0 && typeof selector === 'function') {
                return origGetStats(selector, successCallback);
            }

            var fixChromeStats = function(response) {
                var standardReport = {};
                var reports = response.result();
                reports.forEach(function(report) {
                    var standardStats = {
                        id: report.id,
                        timestamp: report.timestamp,
                        type: report.type
                    };
                    report.names().forEach(function(name) {
                        standardStats[name] = report.stat(name);
                    });
                    standardReport[standardStats.id] = standardStats;
                });

                return standardReport;
            };

            if (arguments.length >= 2) {
                var successCallbackWrapper = function(response) {
                    args[1](fixChromeStats(response));
                };

                return origGetStats.apply(this, [successCallbackWrapper, arguments[0]]);
            }

            // promise-support
            return new Promise(function(resolve, reject) {
                if (args.length === 1 && selector === null) {
                    origGetStats.apply(self, [
                        function(response) {
                            resolve.apply(null, [fixChromeStats(response)]);
                        }, reject]);
                } else {
                    origGetStats.apply(self, [resolve, reject]);
                }
            });
        };

        return pc;
    };

    // wrap static methods. Currently just generateCertificate.
    if (webkitRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
            get: function() {
                if (arguments.length) {
                    return webkitRTCPeerConnection.generateCertificate.apply(null,
                                                                             arguments);
                } else {
                    return webkitRTCPeerConnection.generateCertificate;
                }
            }
        });
    }

    // add promise support
    ['createOffer', 'createAnswer'].forEach(function(method) {
        var nativeMethod = webkitRTCPeerConnection.prototype[method];
        webkitRTCPeerConnection.prototype[method] = function() {
            var self = this;
            if (arguments.length < 1 || (arguments.length === 1 &&
                                         typeof(arguments[0]) === 'object')) {
                var opts = arguments.length === 1 ? arguments[0] : undefined;
                return new Promise(function(resolve, reject) {
                    nativeMethod.apply(self, [resolve, reject, opts]);
                });
            } else {
                return nativeMethod.apply(this, arguments);
            }
        };
    });
    
    //'setRemoteDescription',
    ['setLocalDescription',
     'addIceCandidate'].forEach(function(method) {
         var nativeMethod = webkitRTCPeerConnection.prototype[method];
         webkitRTCPeerConnection.prototype[method] = function() {
             var args = arguments;
             var self = this;
             return new Promise(function(resolve, reject) {
                 nativeMethod.apply(self, [args[0],
                                           function() {
                                               resolve();
                                               if (args.length >= 2) {
                                                   args[1].apply(null, []);
                                               }
                                           },
                                           function(err) {
                                               reject(err);
                                               if (args.length >= 3) {
                                                   args[2].apply(null, [err]);
                                               }
                                           }]
                 );
             });
         };
     });

    // getUserMedia constraints shim.
    var constraintsToChrome = function(c) {
        if (typeof c !== 'object' || c.mandatory || c.optional) {
            return c;
        }
        var cc = {};
        Object.keys(c).forEach(function(key) {
            if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
                return;
            }
            var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
            if (r.exact !== undefined && typeof r.exact === 'number') {
                r.min = r.max = r.exact;
            }
            var oldname = function(prefix, name) {
                if (prefix) {
                    return prefix + name.charAt(0).toUpperCase() + name.slice(1);
                }
                return (name === 'deviceId') ? 'sourceId' : name;
            };
            if (r.ideal !== undefined) {
                cc.optional = cc.optional || [];
                var oc = {};
                if (typeof r.ideal === 'number') {
                    oc[oldname('min', key)] = r.ideal;
                    cc.optional.push(oc);
                    oc = {};
                    oc[oldname('max', key)] = r.ideal;
                    cc.optional.push(oc);
                } else {
                    oc[oldname('', key)] = r.ideal;
                    cc.optional.push(oc);
                }
            }
            if (r.exact !== undefined && typeof r.exact !== 'number') {
                cc.mandatory = cc.mandatory || {};
                cc.mandatory[oldname('', key)] = r.exact;
            } else {
                ['min', 'max'].forEach(function(mix) {
                    if (r[mix] !== undefined) {
                        cc.mandatory = cc.mandatory || {};
                        cc.mandatory[oldname(mix, key)] = r[mix];
                    }
                });
            }
        });
        if (c.advanced) {
            cc.optional = (cc.optional || []).concat(c.advanced);
        }
        return cc;
    };

    getUserMedia = function(constraints, onSuccess, onError) {
        if (constraints.audio) {
            constraints.audio = constraintsToChrome(constraints.audio);
        }
        if (constraints.video) {
            constraints.video = constraintsToChrome(constraints.video);
        }
        webrtcUtils.log('chrome: ' + JSON.stringify(constraints));
        return navigator.webkitGetUserMedia(constraints, onSuccess, onError);
    };
    navigator.getUserMedia = getUserMedia;
    
    if (!navigator.mediaDevices) {
        navigator.mediaDevices = {getUserMedia: requestUserMedia,
                                  enumerateDevices: function() {
                                      return new Promise(function(resolve) {
                                          var kinds = {audio: 'audioinput', video: 'videoinput'};
                                          return MediaStreamTrack.getSources(function(devices) {
                                              resolve(devices.map(function(device) {
                                                  return {label: device.label,
                                                          kind: kinds[device.kind],
                                                          deviceId: device.id,
                                                          groupId: ''};
                                              }));
                                          });
                                      });
                                  }};
    }
    
    // A shim for getUserMedia method on the mediaDevices object.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = requestUserMedia;
    } else {
        // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
        // function which returns a Promise, it does not accept spec-style
        // constraints.
        var origGetUserMedia = navigator.mediaDevices.getUserMedia.
                                         bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = function(c) {
            webrtcUtils.log('spec:   ' + JSON.stringify(c)); // whitespace for alignment
            c.audio = constraintsToChrome(c.audio);
            c.video = constraintsToChrome(c.video);
            webrtcUtils.log('chrome: ' + JSON.stringify(c));
            return origGetUserMedia(c);
        };
    }

    // Dummy devicechange event methods.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
        navigator.mediaDevices.addEventListener = function() {
            webrtcUtils.log('Dummy mediaDevices.addEventListener called.');
        };
    }
    if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
        navigator.mediaDevices.removeEventListener = function() {
            webrtcUtils.log('Dummy mediaDevices.removeEventListener called.');
        };
    }

    // Attach a media stream to an element.
    attachMediaStream = function(element, stream) {
        if (webrtcDetectedVersion >= 43) {
            element.srcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            webrtcUtils.log('Error attaching stream to element.');
        }
    };
    reattachMediaStream = function(to, from) {
        if (webrtcDetectedVersion >= 43) {
            to.srcObject = from.srcObject;
        } else {
            to.src = from.src;
        }
    };

}

// Returns the result of getUserMedia as a Promise.
function requestUserMedia(constraints) {
    return new Promise(function(resolve, reject) {
        getUserMedia(constraints, resolve, reject);
    });
}

