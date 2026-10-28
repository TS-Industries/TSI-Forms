// Customer output is deliberately empty until individual records are explicitly
// approved for customer disclosure. Free-text job content is never auto-exported.
export function customerReport(job) {
 return {work_order:job,status:'not_released',records:[],notice:'Customer disclosure review required'};
}
export function internalReport(job,events,state) {
 return {work_order:job,status:'not_released',events,state};
}
