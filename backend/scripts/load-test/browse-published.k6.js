import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = (__ENV.K6_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const paths = [
  '/research/published',
  '/research/published?q=research',
  '/research/published?sort=newest&limit=12',
  '/research/published?page=2',
];

export default function browsePublished() {
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${API_BASE}${path}`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has success envelope': (r) => {
      try {
        const body = r.json();
        return body.success === true;
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}
