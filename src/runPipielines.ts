import App from "@triply/triplydb";
import dotenv from "dotenv";

// Define constants
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
  dataset: any,
  graphName: string,
): Promise<void> {
  try {
    await account.runPipeline({
      queries: queries,
      destination: {
        dataset: dataset,
        graph: graphName,
      },
    });
  } catch (error) {
    console.error(`Error running pipeline for graph ${graphName}:`, error);
  }
}

async function runPipelines(): Promise<void> {
  const account = await triply.getAccount("Personenthesaurus");

  // Get the datasets
  const constructThesaurusDataset = await account.getDataset(
    "Construct-Thesaurus",
  );
  const thesaurusDataset = await account.getDataset("Thesaurus");

  // Get the queries
  const wikidata = await (
    await account.getQuery("muziekweb-wikidata-fix")
  ).useVersion("latest");
  const ptcallSigns = await (
    await account.getQuery("pt-callSigns")
  ).useVersion("latest");
  const ptRelations = await (
    await account.getQuery("pt-relations")
  ).useVersion(10); // also try version 17
  const thesaurusCore = await (
    await account.getQuery("thesaurus-core")
  ).useVersion(6); // also try version 20
  const thesaurusRemaining = await (
    await account.getQuery("thesaurus-remaining")
  ).useVersion("latest");
  const thesaurusVerrijking = await (
    await account.getQuery("thesaurus-verrijking")
  ).useVersion("latest");

  console.info("Delete existing graphs");
  await deleteGraph(constructThesaurusDataset, verrijkingGraphName);
  await deleteGraph(constructThesaurusDataset, relatiesGraphName);
  await deleteGraph(constructThesaurusDataset, coreGraphName);
  await deleteGraph(constructThesaurusDataset, remainingGraphName);
  await deleteGraph(thesaurusDataset, coreGraphName);
  await deleteGraph(thesaurusDataset, remainingGraphName);
  await deleteGraph(thesaurusDataset, thesaurusVerrijkingGraphName);

  console.info("Verrijkingen: muziekweb-wikidata-fix, pt-callSigns");
  await runPipeline(
    account,
    [wikidata, ptcallSigns],
    constructThesaurusDataset,
    verrijkingGraphName,
  );

  console.info("Relaties: pt-relations");
  await runPipeline(
    account,
    [ptRelations],
    constructThesaurusDataset,
    relatiesGraphName,
  );

  console.info("Thesaurus Core => Thesaurus && Construct Thesaurus");
  await runPipeline(account, [thesaurusCore], thesaurusDataset, coreGraphName);
  await runPipeline(
    account,
    [thesaurusCore],
    constructThesaurusDataset,
    coreGraphName,
  );

  console.info("Thesaurus Remaining => Thesaurus && Construct Thesaurus");
  await runPipeline(
    account,
    [thesaurusRemaining],
    thesaurusDataset,
    remainingGraphName,
  );
  await runPipeline(
    account,
    [thesaurusRemaining],
    constructThesaurusDataset,
    remainingGraphName,
  );

  console.info("Thesaurus Verrijking => Thesaurus");
  await runPipeline(
    account,
    [thesaurusVerrijking],
    thesaurusDataset,
    thesaurusVerrijkingGraphName,
  );
}

// Call the runPipelines function to start the process
runPipelines().catch((error) => {
  console.error("Error in runPipelines:", error);
});