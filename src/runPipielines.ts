import App from "@triply/triplydb";
import Dataset from "@triply/triplydb/Dataset.js";
import dotenv from "dotenv";

// Define constants
const accoutName = "Personenthesaurus";
const personenthesaurusAccountName = "Personenthesaurus";
const constructThesaurusDatasetName = "Construct-Thesaurus";
const thesaurusDatasetName = "Thesaurus";

const graphs =
  "https://podiumkunst.triply.cc/Personenthesaurus/Construct-Thesaurus/graphs/";
const verrijkingGraphName = graphs + "verrijkingen";
const relatiesGraphName = graphs + "relaties";
const coreGraphName = graphs + "thesaurus-core";
const remainingGraphName = graphs + "thesaurus-remaining";
const thesaurusVerrijkingGraphName = graphs + "thesaurus-verrijking";

dotenv.config();
const triply = App.get({ token: process.env.TRIPLYDB_TOKEN });

async function deleteGraph(dataset: any, graphName: string): Promise<void> {
  try {
    const graph = await dataset.getGraph(graphName);
    await graph.delete();
  } catch (error) {}
}

async function runPipeline(
  account: any,
  queries: any[],
  sourceDataSet: any,
  destinationDataSet: any,
  graphName: string,
): Promise<void> {
  try {
    await account.runPipeline({
      queries: queries,
      destination: {
        dataset: destinationDataSet,
        graph: graphName,
      },
      source: sourceDataSet,
    });
  } catch (error) {
    console.error(`Error running pipeline for graph ${graphName}:`, error);
  }
}

async function runPipelines(): Promise<void> {
  const account = await triply.getAccount(accoutName);
  const personenthesaurusAccount = await triply.getAccount(
    personenthesaurusAccountName,
  );

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
    await personenthesaurusAccount.getQuery("muziekweb-wikidata-fix")
  ).useVersion("latest");
  const ptcallSigns = await (
    await personenthesaurusAccount.getQuery("pt-callSigns")
  ).useVersion("latest");
  const ptRelations = await (
    await personenthesaurusAccount.getQuery("pt-relations")
  ).useVersion(17);
  const thesaurusCore = await (
    await personenthesaurusAccount.getQuery("thesaurus-core")
  ).useVersion(20);
  const thesaurusRemaining = await (
    await personenthesaurusAccount.getQuery("thesaurus-remaining")
  ).useVersion(52);
  const thesaurusVerrijking = await (
    await personenthesaurusAccount.getQuery("thesaurus-verrijking")
  ).useVersion("latest");

  console.info("Delete existing graphs");
  await deleteGraph(constructThesaurusDataset, verrijkingGraphName);
  await deleteGraph(constructThesaurusDataset, relatiesGraphName);
  await deleteGraph(constructThesaurusDataset, coreGraphName);
  await deleteGraph(thesaurusDataset, coreGraphName);
  await deleteGraph(constructThesaurusDataset, remainingGraphName);
  await deleteGraph(thesaurusDataset, remainingGraphName);
  await deleteGraph(thesaurusDataset, thesaurusVerrijkingGraphName);

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

  console.info("Thesaurus Core => Thesaurus && Construct Thesaurus");
  await runPipeline(
    account,
    [thesaurusCore],
    constructThesaurusDataset,
    thesaurusDataset,
    coreGraphName,
  );
  await runPipeline(
    account,
    [thesaurusCore],
    constructThesaurusDataset,
    constructThesaurusDataset,
    coreGraphName,
  );

  console.info("Thesaurus Remaining => Thesaurus && Construct Thesaurus");
  await runPipeline(
    account,
    [thesaurusRemaining],
    constructThesaurusDataset,
    thesaurusDataset,
    remainingGraphName,
  );
  await runPipeline(
    account,
    [thesaurusRemaining],
    constructThesaurusDataset,
    constructThesaurusDataset,
    remainingGraphName,
  );

  console.info("Thesaurus Verrijking => Thesaurus");
  await runPipeline(
    account,
    [thesaurusVerrijking],
    constructThesaurusDataset,
    thesaurusDataset,
    thesaurusVerrijkingGraphName,
  );
}

// Call the runPipelines function to start the process
runPipelines().catch((error) => {
  console.error("Error in runPipelines:", error);
});
