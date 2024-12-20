import App from "@triply/triplydb";
import Dataset from "@triply/triplydb/Dataset.js";
import dotenv from "dotenv";
import {
  accountName,
  constructThesaurusDatasetName,
  coreGraphName,
  relatiesGraphName,
  remainingGraphName,
  runPipeline,
  thesaurusDatasetName,
  thesaurusVerrijkingGraphName,
  verrijkingGraphName,
  prefLabelsGraphName,
} from "./helpers.js";

dotenv.config();
const triply = App.get({ token: process.env.TRIPLYDB_TOKEN });

async function runPipelines(): Promise<void> {
  const account = await triply.getAccount(accountName);

  // Get the datasets
  let constructThesaurusDataset: Dataset;
  try {
    constructThesaurusDataset = await account.getDataset(
      constructThesaurusDatasetName,
    );
  } catch (error) {
    constructThesaurusDataset = await account.addDataset(
      constructThesaurusDatasetName,
    );
  }
  if (!constructThesaurusDataset)
    throw new Error(
      `Kon de dataset ${constructThesaurusDatasetName} niet aanmaken in TriplyDB`,
    );

  let thesaurusDataset: Dataset;
  try {
    thesaurusDataset = await account.getDataset(thesaurusDatasetName);
  } catch (error) {
    thesaurusDataset = await account.addDataset(thesaurusDatasetName);
  }
  if (!thesaurusDataset)
    throw new Error(
      `Kon de dataset ${thesaurusDatasetName} niet aanmaken in TriplyDB`,
    );

  // Get the queries
  const wikidata = await (
    await account.getQuery("muziekweb-wikidata-fix")
  ).useVersion("latest");
  const ptcallSigns = await (
    await account.getQuery("pt-callSigns")
  ).useVersion("latest");
  const ptRelations = await (
    await account.getQuery("pt-relations")
  ).useVersion("latest");
  const thesaurusCore = await (
    await account.getQuery("thesaurus-core")
  ).useVersion("latest");
  const thesaurusRemaining = await (
    await account.getQuery("thesaurus-remaining")
  ).useVersion("latest");
  const thesaurusVerrijking = await (
    await account.getQuery("thesaurus-verrijking")
  ).useVersion("latest");
  const prefLabels = await (
    await account.getQuery("thesaurus-preflabels")
  ).useVersion("latest");

  console.info("Verrijkingen: muziekweb-wikidata-fix, pt-callSigns");
  await runPipeline(
    account,
    [wikidata, ptcallSigns],
    constructThesaurusDataset,
    constructThesaurusDataset,
    verrijkingGraphName,
  );

  console.info("Relaties: pt-relations");
  await runPipeline(
    account,
    [ptRelations],
    constructThesaurusDataset,
    constructThesaurusDataset,
    relatiesGraphName,
  );

  console.info("Thesaurus Core => Construct Thesaurus");
  await runPipeline(
    account,
    [thesaurusCore],
    constructThesaurusDataset,
    constructThesaurusDataset,
    coreGraphName,
  );

  console.info("Thesaurus Remaining => Construct Thesaurus");
  await runPipeline(
    account,
    [thesaurusRemaining],
    constructThesaurusDataset,
    constructThesaurusDataset,
    remainingGraphName,
  );

  console.info("Thesaurus Core && Thesaurus Remaining => Thesaurus");
  await thesaurusDataset.importFromDataset(constructThesaurusDataset, {
    graphNames: [coreGraphName, remainingGraphName],
    overwrite: true,
  });

  console.info("Thesaurus Verrijking => Thesaurus");
  await runPipeline(
    account,
    [thesaurusVerrijking],
    constructThesaurusDataset,
    thesaurusDataset,
    thesaurusVerrijkingGraphName,
  );

  console.info("PrefLabels => Thesaurus");
  await runPipeline(
    account,
    [prefLabels],
    thesaurusDataset,
    thesaurusDataset,
    prefLabelsGraphName,
  );

  console.info("Thesaurus: Update services");
  for await (const service of thesaurusDataset.getServices()) {
    await service.update({ rollingUpdate: true }).catch((error) => {
      console.error("Error updating service:", error);
    });
  }
}

// Call the runPipelines function to start the process
runPipelines().catch((error) => {
  console.error("Error in runPipelines:", error);
});
