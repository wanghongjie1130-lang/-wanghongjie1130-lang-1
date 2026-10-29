(function(){"use strict";
const clean=value=>String(value??"").trim();
const productLine=product=>product?`${clean(product.brand)} ${clean(product.name)} · ${clean(product.shade||"shade unknown")} | ${clean(product.colorName||product.color||"color unknown")} | ${clean(product.finish||product.texture||"finish unknown")} | ${clean(product.approximateColor||product.swatch||"approximate color unknown")}`:"not assigned";
function buildImageSpecification(makeupPlan,beautyProfile={},products=makeupPlan.products||[]){
  const p=makeupPlan;
  return {
    schemaVersion:"1.0",
    lookId:p.lookId,
    subject:{presentation:"realistic beauty editorial portrait",skinTexture:"natural visible skin texture",referenceFace:p.referenceFace||null,identityRule:p.referenceFace?"use supplied reference; never claim a different face is the user":"generic model only",faceFeatures:{faceShape:beautyProfile.faceShape||"unspecified",eyeShape:beautyProfile.eyeShape||"unspecified",eyeDirection:beautyProfile.eyeDirection||"unspecified",lipRatio:beautyProfile.lipRatio||"unspecified"}},
    style:{name:p.style,intensity:p.intensity,scene:p.scene,composition:p.composition,colorRelation:p.colorRelation||"harmonious"},
    makeup:{complexion:p.skin,eyes:p.eyes,cheeks:p.cheeks,lips:p.lips},
    products:products.map(product=>({id:product.id||product.productId||null,brand:product.brand,name:product.name,shade:product.shade,color:product.colorName||product.color,approximateColor:product.approximateColor||product.swatch,finish:product.finish||product.texture,colorEvidence:product.colorEvidence||"algorithm_approximation"})),
    lighting:{master:p.lighting||"soft_daylight",variants:["soft_daylight","cloudy_diffused","warm_indoor","cool_indoor","low_light","flash"],variantRule:"derive every lighting version from the same master image, identity, composition and makeup"},
    camera:{framing:"close beauty portrait",angle:"front three-quarter neutral",lens:"portrait lens, minimal distortion"},
    avoid:[...(p.avoid||[])],
    dataBinding:{source:"MakeupPlan",productsLocked:Boolean(p.locks?.products),colorsLocked:Boolean(p.locks?.colors),styleLocked:Boolean(p.locks?.style),intensityLocked:Boolean(p.locks?.intensity)}
  };
}
function buildMakeupImagePrompt(makeupPlan,beautyProfile={},products=makeupPlan.products||[]){
  const spec=buildImageSpecification(makeupPlan,beautyProfile,products),m=spec.makeup;
  const prompt=[
    `${spec.subject.presentation}; ${spec.subject.skinTexture}. Style: ${spec.style.name}; intensity ${spec.style.intensity}/5; scene ${spec.style.scene}; composition ${spec.style.composition}; color relation ${spec.style.colorRelation}. Face features: ${Object.entries(spec.subject.faceFeatures).map(([key,value])=>`${key} ${value}`).join(", ")}.`,
    `Complexion: ${clean(m.complexion.coverage)} coverage, ${clean(m.complexion.finish)} finish, ${clean(m.complexion.powder)} powder, ${clean(m.complexion.setting)} setting, no excessive smoothing.`,
    `Eyes: ${clean(m.eyes.primaryColor.name)} ${clean(m.eyes.primaryColor.hexApprox)} primary and ${clean(m.eyes.secondaryColor.name)} ${clean(m.eyes.secondaryColor.hexApprox)} secondary; ${clean(m.eyes.finish)} finish; ${clean(m.eyes.shape)} shape. Placement: lid ${clean(m.eyes.placement.lid)}, outer corner ${clean(m.eyes.placement.outerCorner)}, crease ${clean(m.eyes.placement.crease)}, lower lash line ${clean(m.eyes.placement.lowerLashLine)}. Blend ${clean(m.eyes.placement.direction)}. Liner: ${m.eyes.liner.enabled?`${clean(m.eyes.liner.color)}, ${clean(m.eyes.liner.shape)}`:"disabled"}.`,
    `Cheeks: ${clean(m.cheeks.color)} ${clean(m.cheeks.hexApprox)}, ${clean(m.cheeks.finish)}, ${clean(m.cheeks.opacity)} application, placed ${clean(m.cheeks.placement)}.`,
    `Lips: ${clean(m.lips.color)} ${clean(m.lips.hexApprox)}, ${clean(m.lips.bias)}, ${clean(m.lips.depth)}, ${clean(m.lips.saturation)}, ${clean(m.lips.finish)}, ${clean(m.lips.opacity)} opacity, ${clean(m.lips.edge)} edges, ${clean(m.lips.application)} application.`,
    `Products: ${spec.products.map(productLine).join("; ")||"none assigned"}.`,
    `Lighting: ${spec.lighting.master}. Keep product colors, placement, finish, identity and composition bound to this specification.`
  ].join("\n");
  return {imageSpecification:spec,prompt,negativePrompt:spec.avoid.join(", ")};
}
window.SEVB_MAKEUP_PROMPT_BUILDER={buildImageSpecification,buildMakeupImagePrompt};
}());
