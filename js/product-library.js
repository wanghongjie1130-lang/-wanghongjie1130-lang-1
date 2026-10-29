(function(){"use strict";
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const root=$("#library-results");if(!root)return;
let products=[],filtered=[],sortMode="relevance",compare=new Set(),favorites=new Set(JSON.parse(localStorage.getItem("sevb-product-favorites")||"[]"));
const filters={query:"",brand:"",category:"",format:"",finish:"",ingredient:"",price:""};
const escape=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const option=(value,label=value)=>`<option value="${escape(value)}">${escape(label)}</option>`;
const statusText=status=>status?.label||"DATA INCOMPLETE";

function matches(product){
  const query=filters.query.toLowerCase(),haystack=[product.brand,product.name,product.productLine,product.department,product.category,product.subcategory,product.format,...product.finishes,...product.shades.flatMap(item=>[item.name,item.code]),...product.basicFilterData.searchTags].join(" ").toLowerCase();
  if(query&&!query.split(/\s+/).every(term=>haystack.includes(term)))return false;
  if(filters.brand&&product.normalizedBrand!==filters.brand)return false;
  if(filters.category&&product.category!==filters.category)return false;
  if(filters.format&&product.format!==filters.format)return false;
  if(filters.finish&&!product.finishes.includes(filters.finish))return false;
  if(filters.ingredient&&!product.basicFilterData.ingredients.some(item=>item.toLowerCase().includes(filters.ingredient.toLowerCase())))return false;
  if(filters.price){const max=Number(filters.price);if(product.priceMin==null||product.priceMin>max)return false}
  return true;
}

function render(){
  filtered=products.filter(matches);if(sortMode==="brand")filtered.sort((a,b)=>a.brand.localeCompare(b.brand));if(sortMode==="price-low")filtered.sort((a,b)=>(a.priceMin??Infinity)-(b.priceMin??Infinity));if(sortMode==="price-high")filtered.sort((a,b)=>(b.priceMin??-Infinity)-(a.priceMin??-Infinity));if(sortMode==="complete")filtered.sort((a,b)=>b.dataCompleteness-a.dataCompleteness);root.replaceChildren();
  $("#library-status").textContent=`显示 ${filtered.length} / ${products.length} 个 Canonical Products。未知字段不会被当作“不含”或“不符合”。`;
  const count=$("#library-count-label");if(count)count.textContent=`${filtered.length} PRODUCTS`;
  if(!filtered.length){root.innerHTML='<section class="library-empty"><h2>没有直接匹配的产品</h2><p>可以放宽类别、成分或价格条件；数据不足的产品不会被自动判断为不符合。</p></section>';return}
  filtered.forEach(product=>{
    const card=document.createElement("article");card.className="library-card";
    card.innerHTML=`<div class="library-image"><img alt=""><span class="image-type"></span><button class="library-favorite" type="button" aria-label="收藏">${favorites.has(product.id)?"♥":"♡"}</button></div><div class="library-card-body"><p class="eyebrow">${escape(product.department)} · ${escape(product.format)}</p><h2>${escape(product.brand)}</h2><h3>${escape(product.name)}</h3><p>${escape(product.shades[0]?.name||"色号资料不足")} · ${product.priceMin==null?"价格资料不足":`${escape(product.currency)} ${product.priceMin}`}</p><div class="library-badges"><span>${escape(statusText(product.status))}</span><span>完整度 ${product.dataCompleteness}%</span></div><div class="library-actions"><button class="text-button detail" type="button">查看产品资料</button><label><input class="compare" type="checkbox" ${compare.has(product.id)?"checked":""}> 比较</label></div></div>`;
    const image=$("img",card),label=$(".image-type",card);window.SEVB_IMAGE_POLICY.mount(image,{...product,images:product.imageOptions},{labelElement:label,alt:`${product.brand} ${product.name}`});
    $(".detail",card).onclick=()=>openDetail(product);
    $(".library-favorite",card).onclick=event=>{favorites.has(product.id)?favorites.delete(product.id):favorites.add(product.id);localStorage.setItem("sevb-product-favorites",JSON.stringify([...favorites]));event.currentTarget.textContent=favorites.has(product.id)?"♥":"♡"};
    $(".compare",card).onchange=event=>{if(event.target.checked&&compare.size>=3){event.target.checked=false;return alert("一次最多比较 3 款产品")}event.target.checked?compare.add(product.id):compare.delete(product.id);$("#library-compare").disabled=compare.size<2};
    root.append(card);
  });
}

function detailImages(product,detail){
  const variant=detail.variants?.[0],groups=[
    ["Official",[variant?.images?.officialPrimary,detail.images?.officialPrimary,...(variant?.images?.officialSecondary||[]),...(detail.images?.officialSecondary||[])]],
    ["Swatches",[...(variant?.images?.officialSwatches||[]),...(detail.images?.officialSwatches||[])]],
    ["Retailer",[...(variant?.images?.retailerImages||[]),...(detail.images?.retailerImages||[])]],
    ["My Photo",[...(variant?.images?.userImages||[]),...(detail.images?.userImages||[])]],
    ["Texture",[detail.images?.textureReference]]
  ].map(([name,items])=>[name,items.filter(Boolean)]).filter(([,items])=>items.length),hasIdentification=groups.some(([name])=>["Official","Retailer","My Photo"].includes(name));
  if(!hasIdentification)return `<div class="detail-image-empty"><img src="${escape(window.SEVB_IMAGE_POLICY.categoryPlaceholder(product))}" alt="官方产品图暂缺，显示品类材质占位"><span>OFFICIAL PRODUCT IMAGE PENDING · MATERIAL PLACEHOLDER</span><p>没有确认匹配的官网、授权零售商或用户图片，因此没有使用相似商品图。Texture Reference 只作为材质资料，不冒充产品识别图。</p></div>`;
  return `<div class="detail-image-tabs">${groups.map(([name],i)=>`<button type="button" data-image-group="${i}" class="${i?'':'active'}">${name}</button>`).join("")}</div><div class="detail-image-stage"><img src="${escape(groups[0][1][0])}" alt="${escape(product.brand)} ${escape(product.name)}"><span>${groups[0][0]}</span></div>`;
}

async function openDetail(product){
  const dialog=$("#library-detail"),body=$(".library-detail-body",dialog);body.innerHTML='<p class="loading-state">正在读取分片产品资料…</p>';dialog.showModal();
  try{
    const response=await fetch(product.detailPath);if(!response.ok)throw new Error(`HTTP ${response.status}`);const detail=await response.json(),price=detail.variants.flatMap(item=>item.prices)[0];
    body.innerHTML=`<section class="library-detail-visual">${detailImages(product,detail)}</section><section class="library-detail-info"><p class="eyebrow">${escape(detail.taxonomy.department)} · ${escape(detail.taxonomy.category)}</p><h2>${escape(detail.brand.originalValue)}</h2><h3>${escape(detail.name.originalValue)}</h3><p>${escape(detail.variants[0]?.shade?.shadeName||"色号资料不足")}</p><div class="library-badges"><span>${escape(detail.status.label)}</span><span>DATA COMPLETENESS ${detail.dataCompleteness.score}%</span></div><dl><dt>产品形态</dt><dd>${escape(detail.taxonomy.format)}</dd><dt>Finish</dt><dd>${escape(detail.finish.join("、")||"资料不足")}</dd><dt>成分</dt><dd>${detail.ingredientLists.length?escape(detail.ingredientLists[0].ingredients.join("、")):"成分资料不足，不能视为不含"}</dd><dt>参考价格</dt><dd>${price?`${escape(price.currency)} ${price.price} · 最后更新 ${escape(price.date)}`:"价格资料不足"}</dd><dt>来源</dt><dd>${detail.sources.map(source=>source.sourceURL?`<a href="${escape(source.sourceURL)}" target="_blank" rel="noopener">${escape(source.source)} ↗</a>`:escape(source.source)).join("<br>")}</dd></dl><div class="library-detail-actions"><button class="button dark add-collection" type="button">加入我的化妆包</button><button class="button outline add-favorite" type="button">加入收藏</button>${detail.sources[0]?.sourceURL?`<a class="button outline" href="${escape(detail.sources[0].sourceURL)}" target="_blank" rel="noopener">查看购买渠道</a>`:""}</div><p class="copyright-note">Product imagery and trademarks belong to their respective brands and are displayed for product identification and educational/reference purposes.</p></section>`;
    const groups=$$("[data-image-group]",body),stage=$(".detail-image-stage img",body);groups.forEach(button=>button.onclick=()=>{groups.forEach(item=>item.classList.toggle("active",item===button));const detailGroups=[variantImages(detail,"official"),variantImages(detail,"swatch"),variantImages(detail,"retailer"),variantImages(detail,"user"),[detail.images?.textureReference].filter(Boolean)].filter(items=>items.length);stage.src=detailGroups[+button.dataset.imageGroup]?.[0]||window.SEVB_IMAGE_POLICY.PLACEHOLDER});
    $(".add-collection",body).onclick=()=>addToCollection(product,detail);$(".add-favorite",body).onclick=()=>{favorites.add(product.id);localStorage.setItem("sevb-product-favorites",JSON.stringify([...favorites]));render()};
  }catch(error){body.innerHTML=`<section class="library-empty"><h2>产品资料暂时无法读取</h2><p>${escape(error.message)}</p></section>`}
}
function variantImages(detail,type){const variant=detail.variants?.[0],images=detail.images||{};if(type==="official")return [variant?.images?.officialPrimary,images.officialPrimary,...(variant?.images?.officialSecondary||[]),...(images.officialSecondary||[])].filter(Boolean);if(type==="swatch")return [...(variant?.images?.officialSwatches||[]),...(images.officialSwatches||[])];if(type==="retailer")return [...(variant?.images?.retailerImages||[]),...(images.retailerImages||[])];return [...(variant?.images?.userImages||[]),...(images.userImages||[])]}
function addToCollection(product,detail){const key="sevb-data-v2",state=JSON.parse(localStorage.getItem(key)||"null");if(!state)return alert("请先打开一次美妆档案或化妆包，再添加产品。");if(state.collection.some(item=>item.productId===product.id))return alert("这款产品已经在你的化妆包中。");const variant=detail.variants[0],imageCandidates=window.SEVB_IMAGE_POLICY.candidates(detail,variant);state.collection.unshift({id:`owned-${Date.now()}`,productId:product.id,variantId:variant?.variantID,brand:product.brand,name:product.name,shade:variant?.shade?.shadeName||"",category:detail.taxonomy.displayCategory,color:variant?.shade?.officialDescription||"",texture:detail.finish.join("、"),images:detail.images,imageSources:detail.imageSources,officialImage:imageCandidates.find(item=>item.sourceType==="official")?.url||null,userImages:[],swatch:variant?.shade?.swatch||"#b7aaa5",frequency:"偶尔",rating:3,notes:"从产品百科添加",favorite:false});localStorage.setItem(key,JSON.stringify(state));alert("已加入我的化妆包")}

function compareProducts(){const list=[...compare].map(id=>products.find(item=>item.id===id)).filter(Boolean),dialog=$("#library-compare-dialog"),body=$(".library-compare-body",dialog);body.innerHTML=`<h2>产品比较</h2><div class="library-compare-grid">${list.map(product=>`<article><div class="compare-product-image"><img alt=""><span class="image-type"></span></div><h3>${escape(product.brand)}</h3><strong>${escape(product.name)}</strong><p>${escape(product.shades[0]?.name||"")}</p><dl><dt>价格</dt><dd>${product.priceMin==null?"资料不足":`${escape(product.currency)} ${product.priceMin}`}</dd><dt>形态</dt><dd>${escape(product.format)}</dd><dt>Finish</dt><dd>${escape(product.finishes.join("、")||"资料不足")}</dd><dt>状态</dt><dd>${escape(product.status.label)}</dd></dl></article>`).join("")}</div>`;$$('article',body).forEach((article,i)=>window.SEVB_IMAGE_POLICY.mount($("img",article),{...list[i],images:list[i].imageOptions},{labelElement:$(".image-type",article)}));dialog.showModal()}

async function init(){
  try{const response=await fetch("data/products-index.json");if(!response.ok)throw new Error(`HTTP ${response.status}`);products=await response.json();
    const values=key=>[...new Set(products.flatMap(product=>Array.isArray(product[key])?product[key]:[product[key]]).filter(Boolean))].sort();
    $("#library-brand").innerHTML=option("","全部品牌")+values("normalizedBrand").map(value=>option(value,products.find(item=>item.normalizedBrand===value)?.brand||value)).join("");
    $("#library-category").innerHTML=option("","全部类别")+values("category").map(value=>option(value)).join("");
    $("#library-format").innerHTML=option("","全部形态")+values("format").map(value=>option(value)).join("");
    $("#library-finish").innerHTML=option("","全部妆效")+values("finishes").map(value=>option(value)).join("");
    [["library-search","query","input"],["library-brand","brand","change"],["library-category","category","change"],["library-format","format","change"],["library-finish","finish","change"],["library-ingredient","ingredient","input"],["library-price","price","change"]].forEach(([id,key,event])=>$("#"+id).addEventListener(event,e=>{filters[key]=e.target.value.trim();render()}));
    $("#library-sort")?.addEventListener("change",event=>{sortMode=event.target.value;render()});$("#library-clear").onclick=()=>{$$("#library-filters input,#library-filters select").forEach(input=>input.value="");Object.keys(filters).forEach(key=>filters[key]="");render()};$("#library-compare").onclick=compareProducts;render();
  }catch(error){root.innerHTML=`<section class="library-empty"><h2>Product Library unavailable</h2><p>${escape(error.message)}</p></section>`}
}
$("#library-detail .dialog-close").onclick=()=>$("#library-detail").close();$("#library-compare-dialog .dialog-close").onclick=()=>$("#library-compare-dialog").close();init();
}());
