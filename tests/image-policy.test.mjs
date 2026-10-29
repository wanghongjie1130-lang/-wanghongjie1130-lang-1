import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function policy(){const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(await fs.readFile(new URL("../js/image-policy.js",import.meta.url),"utf8"),sandbox);return sandbox.window.SEVB_IMAGE_POLICY}

test("product identification image priority is official, retailer, user, placeholder",async()=>{const p=await policy(),rows=p.candidates({images:{officialPrimary:"official.jpg",retailerImages:["retailer.jpg"],userImages:["user.jpg"],textureReference:"texture.jpg",placeholder:"placeholder.svg"}});assert.deepEqual(Array.from(rows,item=>item.sourceType),["official","retailer","user","placeholder"]);assert.equal(rows.some(item=>item.sourceType==="texture"),false)});

test("variant-specific official image precedes generic product official image",async()=>{const p=await policy(),rows=p.candidates({images:{officialPrimary:"series.jpg",retailerImages:[],userImages:[],placeholder:"placeholder.svg"}},{images:{officialPrimary:"shade-999.jpg",retailerImages:[],userImages:[]}});assert.equal(rows[0].url,"shade-999.jpg");assert.equal(rows[1].url,"series.jpg")});
