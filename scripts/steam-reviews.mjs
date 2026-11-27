// Valve migration reference: https://partner.steamgames.com/doc/webapi/IUserReviewsService
export function reviewURL(appid){
 if(!Number.isSafeInteger(appid)||appid<=0)throw Error('Некорректный App ID');
 const url=new URL('https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/');
 url.searchParams.set('input_json',JSON.stringify({appid,languages:['all'],filter:0,day_range:0,review_type:0,purchase_type:1,num_per_page:1,filter_offtopic_activity:true}));
 return url.href;
}
export function parseReviewSummary(payload){
 const q=(payload.response??payload).query_summary;
 if(!q||![q.total_reviews,q.total_positive,q.total_negative].every(n=>Number.isSafeInteger(n)&&n>=0)||q.total_positive+q.total_negative!==q.total_reviews)throw Error('Steam не вернул корректную сводку отзывов');
 return {positive:q.total_positive,negative:q.total_negative,total:q.total_reviews,percent:q.total_reviews?Math.round(q.total_positive/q.total_reviews*1000)/10:null};
}
