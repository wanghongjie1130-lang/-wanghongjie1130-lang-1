(function(){"use strict";
const PLACEHOLDER="assets/images/product-packaging.svg";
const asArray=value=>Array.isArray(value)?value:value?[value]:[];
const unique=items=>items.filter((item,index)=>item.url&&items.findIndex(candidate=>candidate.url===item.url)===index);
function categoryPlaceholder(product={}){const value=[product.department,product.category,product.productType,product.format,product.major].join(" ").toLowerCase();if(/lip|唇/.test(value))return"assets/visuals/placeholders/lips.svg";if(/foundation|conceal|complexion|底妆|粉底|遮瑕/.test(value))return"assets/visuals/placeholders/complexion.svg";if(/mascara|brow|lash|眉|睫/.test(value))return"assets/visuals/placeholders/brows-lashes.svg";if(/tool|brush|工具|刷/.test(value))return"assets/visuals/placeholders/tools.svg";return"assets/visuals/placeholders/powder.svg"}

function candidates(product={},variant=null,{includeTexture=false}={}){
  const images=product.images||{},variantImages=variant?.images||{};
  const rows=[
    ...asArray(variantImages.officialPrimary).map(url=>({url,type:"OFFICIAL PRODUCT IMAGE",sourceType:"official"})),
    ...asArray(images.officialPrimary).map(url=>({url,type:"OFFICIAL PRODUCT IMAGE",sourceType:"official"})),
    ...asArray(variantImages.retailerImages).map(url=>({url,type:"RETAILER PRODUCT IMAGE",sourceType:"retailer"})),
    ...asArray(images.retailerImages).map(url=>({url,type:"RETAILER PRODUCT IMAGE",sourceType:"retailer"})),
    ...asArray(variantImages.userImages).map(url=>({url,type:"USER PHOTO",sourceType:"user"})),
    ...asArray(images.userImages).map(url=>({url,type:"USER PHOTO",sourceType:"user"}))
  ];
  if(product.imageFallbackType&&product.imageFallbackType!=="placeholder"&&product.img)rows.push({url:product.img,type:product.imageType||"PRODUCT IMAGE",sourceType:product.imageFallbackType});
  if(product.userImage)rows.push({url:product.userImage,type:"USER PHOTO",sourceType:"user"});
  if(includeTexture&&images.textureReference)rows.push({url:images.textureReference,type:"TEXTURE REFERENCE",sourceType:"texture"});
  rows.push({url:images.placeholder&&images.placeholder!==PLACEHOLDER?images.placeholder:categoryPlaceholder(product),type:"OFFICIAL PRODUCT IMAGE PENDING · MATERIAL PLACEHOLDER",sourceType:"placeholder"});
  return unique(rows);
}

function mount(img,product,options={}){
  const list=candidates(product,options.variant,options),label=options.labelElement;
  let index=0;
  img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";img.style.objectFit="contain";
  const load=()=>{const item=list[index]||{url:PLACEHOLDER,type:"OFFICIAL PRODUCT IMAGE PENDING",sourceType:"placeholder"};img.src=item.url;img.dataset.imageType=item.sourceType;img.alt=options.alt||`${product.brand||""} ${product.name||"产品"} · ${item.type}`;if(label){label.textContent=item.type;label.dataset.imageType=item.sourceType}};
  img.onerror=()=>{if(index<list.length-1){index+=1;load()}else{img.onerror=null;img.src=PLACEHOLDER}};
  load();
  return list;
}

window.SEVB_IMAGE_POLICY={PLACEHOLDER,categoryPlaceholder,candidates,mount};
}());
