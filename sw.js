// 홈 화면 추가(설치)용 서비스 워커. 캐시는 쓰지 않아서 수정하면 바로 반영된다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
