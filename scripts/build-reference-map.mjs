import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
const root=process.cwd();
const vite=await createServer({appType:"custom",configFile:false,root,resolve:{alias:{"@":root}},server:{middlewareMode:true,hmr:false}});
try {
  const {buildReferenceDataset}=await vite.ssrLoadModule("/server/knowledge/reference-baseline.ts");
  const {createPortableKnowledgeBundle}=await vite.ssrLoadModule("/core/knowledge/portable-bundle.ts");
  const {dataset,patch,review}=buildReferenceDataset();
  await mkdir("outputs",{recursive:true});
  await writeFile("outputs/fmcw-reference-map.json",JSON.stringify(createPortableKnowledgeBundle(dataset),null,2));
  await writeFile("outputs/fmcw-reference-review.json",JSON.stringify({review,diff:patch.projectionDiff},null,2));
  console.log(JSON.stringify({nodes:dataset.nodes.length,cards:dataset.cards.length,added:patch.projectionDiff.nodes.added.length,updatedCards:patch.projectionDiff.cards.updated.length,review:review.accepted}));
} finally {await vite.close();}
