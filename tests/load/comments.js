// k6 load test — CommentGuard Phase 1 baseline
// Target: 100K comments/hour sustained, P99 response < 2s (CHECKLIST §11)
//
// Run: k6 run --env BFF_URL=http://localhost:3001 --env TOKEN=<jwt> tests/load/comments.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const classifyDuration = new Trend("classify_duration");

// 100K comments/hour = ~27.8 req/s
// Ramp up to target over 2 minutes, hold for 5 minutes, ramp down
export const options = {
  stages: [
    { duration: "2m", target: 28 },  // ramp up
    { duration: "5m", target: 28 },  // hold
    { duration: "1m", target: 0 },   // ramp down
  ],
  thresholds: {
    // CHECKLIST §11: P99 response < 2s
    http_req_duration: ["p(99)<2000"],
    errors: ["rate<0.01"],  // <1% error rate
  },
};

const BFF_URL = __ENV.BFF_URL ?? "http://localhost:3001";
const TOKEN = __ENV.TOKEN ?? "";

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

export default function () {
  // 1. List comments (main dashboard load)
  const listRes = http.get(`${BFF_URL}/api/v1/comments?limit=50`, { headers: HEADERS });
  check(listRes, {
    "comments list 200": (r) => r.status === 200,
  });
  errorRate.add(listRes.status !== 200);

  // 2. Dashboard stats
  const statsRes = http.get(`${BFF_URL}/api/v1/dashboard/stats`, { headers: HEADERS });
  check(statsRes, {
    "stats 200": (r) => r.status === 200,
    "stats has totalComments": (r) => JSON.parse(r.body).totalComments !== undefined,
    "stats classification is reference_only": (r) =>
      JSON.parse(r.body).classification === "reference_only",
  });
  errorRate.add(statsRes.status !== 200);

  // 3. Classification endpoint (risk-classifier)
  const classifyRes = http.post(
    "http://localhost:8001/api/v1/classify",
    JSON.stringify({
      comment_id: `load-test-${__VU}-${__ITER}`,
      text: "This is a load test comment for performance baseline measurement.",
      author_platform_id: "load-test-author",
      channel_id: "load-test-channel",
      created_at: new Date().toISOString(),
    }),
    { headers: HEADERS }
  );
  classifyDuration.add(classifyRes.timings.duration);
  check(classifyRes, {
    "classify 200": (r) => r.status === 200,
    "classify reference_only": (r) => JSON.parse(r.body).classification === "reference_only",
  });
  errorRate.add(classifyRes.status !== 200);

  sleep(1);
}
