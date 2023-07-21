/**
 * This endpoint is used to load the resumes into the chain, then upload them to the Pinecone database.
 * Tutorial: https://js.langchain.com/docs/modules/indexes/document_loaders/examples/file_loaders/directory
 * Summarization: https://js.langchain.com/docs/modules/chains/other_chains/summarization
 * Dependencies: npm install pdf-parse
 */

import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAI } from "langchain/llms/openai";
import { VectorDBQAChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";

export default async function handler(req, res) {
  try {
    //    do stuff
    const { prompt } = req.body;

    /** Load Pinecone vector database */
    const client = new PineconeClient();
     await client.init({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
     });

     const pineconeIndex = client.Index(process.env.PINECONE_INDEX);

     // Create vectorestore 
     const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex },
     );

     // Create Vector DBQA Chain + return source docs
     const model = new OpenAI();
     const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
      k: 2,
      returnSourceDocuments: true,
     });

     // Prompt Template
     const promptTemplate = new PromptTemplate({
      template: `Assume you are a Human Resources Director. According to the resumes, answer this question: {question}`,
      inputVariables: ["question"],
     });

     const formattedPrompt = await promptTemplate.format({
      question: prompt,
     });

    //  console.log({ formattedPrompt });

    //call vector dbqa, combine formattedPrompt + chain, log and push response and source to frontend
    const response = await chain.call({
      query: formattedPrompt,
    });

    console.log({ response });

    return res.status(200).json({
      // String
      output: response.text,
      // [Document, Document]
      sourceDocuments: response.sourceDocuments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error" });
  }
}
