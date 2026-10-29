export function buildMakeupEditPrompt(makeupPlan,products=[],beautyProfile={}){if(!makeupPlan?.eyes||!makeupPlan?.cheeks||!makeupPlan?.lips||!makeupPlan?.skin)throw new Error("MakeupPlan is incomplete");const eye=makeupPlan.eyes,cheek=makeupPlan.cheeks,lips=makeupPlan.lips,skin=makeupPlan.skin,tryOn=makeupPlan.tryOn||{},locks=tryOn.locks||{},productLines=products.map(product=>`${product.brand||""} ${product.name||""}; shade ${product.shade||"unknown"}; main hue ${product.mainHue||product.colorName||"unknown"}; hue bias ${product.hueBias||"unknown"}; lightness ${product.lightness??"unknown"}; saturation ${product.saturation??"unknown"}; mutedness ${product.mutedness??"unknown"}; opacity ${product.opacity||"unknown"}; finish ${product.finish||"unknown"}; official swatch ${product.officialSwatch||"not supplied"}; approximate color ${product.approximateColor||"unknown"}; color evidence ${product.colorEvidence||"unknown"}`).join("\n");return `Edit the supplied original portrait. This is an image edit, not a new portrait.

IDENTITY AND COMPOSITION — STRICT:
Preserve the same person's identity, facial structure, eye shape, nose shape, natural lip shape, face proportions, hairstyle, hair color, expression, pose, camera angle, background and clothing. Do not alter age. Do not reshape the face, enlarge the eyes, slim the jaw, reshape the nose or plump the lips. Only add the specified makeup.

SKIN:
Preserve realistic natural skin texture, pores, fine texture, natural shadows and minor visible skin variation. Apply ${skin.coverage} coverage with a ${skin.finish} finish. Powder: ${skin.powder}. Setting: ${skin.setting}. Do not create plastic skin or heavy smoothing.

EYES:
Apply ${eye.primaryColor.name} (${eye.primaryColor.hexApprox}) across the mobile eyelid. Add ${eye.secondaryColor.name} (${eye.secondaryColor.hexApprox}) to the outer corner. Finish: ${eye.finish}. Shape: ${eye.shape}. Lid placement: ${eye.placement.lid}; outer corner: ${eye.placement.outerCorner}; crease: ${eye.placement.crease}; lower lash line: ${eye.placement.lowerLashLine}; blend ${eye.placement.direction}. Liner: ${eye.liner.enabled?`${eye.liner.color}, ${eye.liner.shape}`:"none"}. Preserve eyelid anatomy. No unrequested false lashes and no chunky glitter.

CHEEKS:
Apply ${cheek.color} (${cheek.hexApprox}), ${cheek.opacity}, ${cheek.finish}. Placement: ${cheek.placement}. Keep natural skin visible through the blush and avoid hard edges.

LIPS:
Apply ${lips.color} (${lips.hexApprox}), ${lips.bias}, ${lips.depth}, ${lips.saturation}, ${lips.opacity}, ${lips.finish}, ${lips.application}. Keep ${lips.edge} edges. Preserve natural lip texture and lip lines. Do not change lip shape.

PRODUCT REFERENCES:
${productLines||"No verified product reference supplied; use only the explicit plan colors."}

EDIT CONTROL:
Makeup intensity ${tryOn.intensityPercent??makeupPlan.intensity*20??60}%. Pigment scale ${tryOn.pigmentScale??"plan default"}; complexion coverage scale ${tryOn.coverageScale??"plan default"}; eyeshadow area scale ${tryOn.eyeAreaScale??"plan default"}; blush intensity scale ${tryOn.blushIntensityScale??"plan default"}; lip coverage scale ${tryOn.lipCoverageScale??"plan default"}. This changes the makeup plan's pigment concentration, coverage and placement area; it is not whole-image opacity. Edit scope: ${tryOn.editScope||"same-plan"}.
Locked regions must remain visually unchanged from the supplied image or previous result: ${Object.entries(locks).filter(([,locked])=>locked).map(([name])=>name).join(", ")||"none"}.

LASHES AND BROWS:
Keep natural separated lashes with moderate lengthening, soft black and no dramatic false lashes or heavy clumping unless explicitly requested by the plan. Preserve the user's original brow shape. Allow only subtle gap filling, hair definition and clear-setting effect; do not create standardized social-media brows.

BEAUTY PROFILE:
Face shape ${beautyProfile.faceShape||"unspecified"}; eye shape ${beautyProfile.eyeShape||"unspecified"}; eye direction ${beautyProfile.eyeDirection||"unspecified"}; lip ratio ${beautyProfile.lipRatio||"unspecified"}.

NEGATIVE CONSTRAINTS:
${(makeupPlan.avoid||[]).join(", ")||"No additional constraints."}

Return the same photograph and same person with only this makeup edit. Photorealistic, natural skin, no beauty-filter transformation.`}
