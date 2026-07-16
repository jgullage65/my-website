import type {ChatRequest,RetrievedKnowledge} from "./contracts";

export function retrieveKnowledge(req:ChatRequest):RetrievedKnowledge{
 const q=req.message.toLowerCase();
 const facts=req.knowledge.facts.filter(f=>f.title.toLowerCase().includes(q)||f.content.toLowerCase().includes(q)).slice(0,8);
 const faq=req.knowledge.faq.filter(f=>f.question.toLowerCase().includes(q)||f.answer.toLowerCase().includes(q)).slice(0,5);
 return{
   facts:facts.map(f=>`${f.title}: ${f.content}`),
   faq:faq.map(f=>`Q: ${f.question}\nA: ${f.answer}`)
 };
}
