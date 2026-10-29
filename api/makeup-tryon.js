import {buildMakeupEditPrompt} from "../services/makeup-prompt-builder.js";
import {validateMaskMetadata,maskServiceStatus} from "../services/mask-builder.js";

export const config={api:{bodyParser:false}};
const MODEL=process.env.OPENAI_IMAGE_MODEL||"gpt-image-2.5-sunburst";
const MAX_IMAGE_BYTES=10*1024*1024;
function setCors(req,res){const origin=req.headers?.origin,allowed=process.env.ALLOWED_ORIGIN;if(origin&&allowed&&origin===allowed){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type")}}
function send(res,status,value){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(value))}
async function parseMultipart(req){const chunks=[];let total=0;for await(const chunk of req){chunks.push(chunk);total+=chunk.length;if(total>14*1024*1024)throw new Error("REQUEST_TOO_LARGE")}const request=new Request("http://localhost/api/makeup-tryon",{method:"POST",headers:req.headers,body:Buffer.concat(chunks)});return request.formData()}
export default async function handler(req,res){
  setCors(req,res);if(req.method==="OPTIONS")return send(res,204,{});
  const configured=Boolean(process.env.OPENAI_API_KEY),maskStatus=maskServiceStatus();
  if(req.method==="GET")return send(res,200,{ready:configured,provider:"OpenAI Image API",model:MODEL,endpointStatus:configured?"CONFIGURED":"MISSING_OPENAI_API_KEY",maskBuilder:maskStatus,privacy:"Images are processed only for this request and are not persisted by this endpoint."});
  if(req.method!=="POST")return send(res,405,{error:"METHOD_NOT_ALLOWED"});
  if(!configured)return send(res,503,{error:"IMAGE_SERVICE_NOT_CONFIGURED",message:"写实试妆服务尚未连接。"});
  try{
    const form=await parseMultipart(req),image=form.get("image"),mask=form.get("mask"),plan=JSON.parse(String(form.get("makeupPlan")||"null")),products=JSON.parse(String(form.get("products")||"[]")),profile=JSON.parse(String(form.get("beautyProfile")||"{}")),maskMetadata=JSON.parse(String(form.get("maskMetadata")||"{}"));
    if(!(image instanceof File)||!/^image\/(png|jpeg|webp)$/.test(image.type)||image.size>MAX_IMAGE_BYTES)return send(res,400,{error:"INVALID_IMAGE"});
    if(!plan?.lookId||!Array.isArray(products))return send(res,400,{error:"INVALID_MAKEUP_PLAN"});
    const maskReport=validateMaskMetadata(maskMetadata);if(!(mask instanceof File)||mask.type!=="image/png"||mask.size>MAX_IMAGE_BYTES||!maskReport.valid||!maskReport.feathered||!maskReport.landmarksSupplied)return send(res,400,{error:"INVALID_MASK",message:"写实试妆需要由 MediaPipe landmarks 生成的柔化 PNG 面部蒙版。"});
    const prompt=buildMakeupEditPrompt(plan,products,profile),apiForm=new FormData();apiForm.append("model",MODEL);apiForm.append("image",image,image.name||"portrait.png");apiForm.append("mask",mask,"makeup-mask.png");apiForm.append("prompt",prompt);apiForm.append("input_fidelity","high");apiForm.append("quality","high");
    const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:apiForm}),requestId=response.headers.get("x-request-id"),payload=await response.json();
    if(!response.ok)return send(res,response.status,{error:"IMAGE_EDIT_FAILED",message:payload?.error?.message||"Image edit failed",requestId});
    const base64=payload?.data?.[0]?.b64_json;if(!base64)return send(res,502,{error:"NO_IMAGE_OUTPUT",requestId});
    return send(res,200,{image:`data:image/png;base64,${base64}`,label:"AI MAKEUP SIMULATION",provider:"OpenAI Image API",model:MODEL,requestId,maskSupplied:Boolean(mask),maskReport,makeupPlanSupplied:true,inputImageSupplied:true,privacy:"The endpoint did not persist the uploaded image or generated output."});
  }catch(error){return send(res,error.message==="REQUEST_TOO_LARGE"?413:400,{error:error.message||"REQUEST_FAILED"})}
}
