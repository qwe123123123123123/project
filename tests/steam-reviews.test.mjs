import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewURL,parseReviewSummary} from '../scripts/steam-reviews.mjs';
test('public reviews use the current service and documented enums',()=>{
 const url=new URL(reviewURL(1091500));
 assert.equal(url.origin,'https://api.steampowered.com');
 assert.equal(url.pathname,'/IUserReviewsService/GetAppReviews/v1/');
 const input=JSON.parse(url.searchParams.get('input_json'));
 assert.equal(input.appid,1091500);assert.deepEqual(input.languages,['all']);
 assert.equal(input.review_type,0);assert.equal(input.purchase_type,1);
 assert.equal(input.filter_offtopic_activity,true);assert.equal(input.num_per_page,1);
 assert.equal(url.searchParams.has('key'),false);
});
test('service response does not require legacy success and calculates the percentage',()=>{
 const q={total_reviews:200,total_positive:183,total_negative:17};
 assert.deepEqual(parseReviewSummary({response:{query_summary:q}}),{positive:183,negative:17,total:200,percent:91.5});
 assert.equal(parseReviewSummary({query_summary:q}).percent,91.5);
});
test('missing or inconsistent totals are rejected instead of inventing a rating',()=>{
 for(const payload of [{},{response:{}},{query_summary:{total_reviews:20,total_positive:21,total_negative:0}},{query_summary:{total_reviews:20,total_positive:10,total_negative:9}}])assert.throws(()=>parseReviewSummary(payload));
 assert.equal(parseReviewSummary({query_summary:{total_reviews:0,total_positive:0,total_negative:0}}).percent,null);
});
