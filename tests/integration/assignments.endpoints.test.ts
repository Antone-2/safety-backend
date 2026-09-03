import express from "express";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = {
  create: vi.fn(),
  setTaskDependencies: vi.fn(),
  verifyAuditChain: vi.fn(),
  verifySignatures: vi.fn(),
};

vi.mock("../../src/modules/assignments/assignments.service.js", () => ({ assignmentsService: service }));
vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({ authenticateUser: (req: any,_res: any,next: any) => { req.user={ id:"user-1",email:"manager@example.com",name:"EHS Manager",role:"super-admin" }; next(); } }));
vi.mock("../../src/shared/middleware/rbac.middleware.js", () => ({ requirePermission: () => (_req: any,_res: any,next: any) => next() }));

const { createAssignmentsRouter } = await import("../../src/modules/assignments/assignments.controller.js");

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app=express(); app.use(express.json()); app.use("/api/assignments",createAssignmentsRouter());
  const server=await new Promise<import("http").Server>((resolve)=>{const instance=app.listen(0,()=>resolve(instance));});
  const address=server.address() as AddressInfo;
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve,reject)=>server.close((error)=>error?reject(error):resolve())); }
}

async function request(baseUrl:string,path:string,method="GET",body?:Record<string,unknown>){
  const response=await fetch(`${baseUrl}${path}`,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json()};
}

describe("assignment endpoints",()=>{
  beforeEach(()=>{vi.clearAllMocks();service.create.mockResolvedValue({id:"assignment-1",reportId:"RPT-1",status:"Assigned"});service.verifyAuditChain.mockResolvedValue({valid:true,verifiedEvents:4,issues:[]});service.verifySignatures.mockResolvedValue({valid:true,configured:true,signatures:[]});});

  it("validates and creates a first-class assignment",async()=>withServer(async(baseUrl)=>{
    const response=await request(baseUrl,"/api/assignments","POST",{reportId:"RPT-1",assigneeEmail:"owner@example.com",copiedEmails:[],priority:"High",reason:"Own corrective work",idempotencyKey:"request-12345"});
    expect(response.status).toBe(201); expect(service.create).toHaveBeenCalledWith(expect.objectContaining({reportId:"RPT-1",assigneeEmail:"owner@example.com",idempotencyKey:"request-12345"}),expect.objectContaining({user:expect.objectContaining({role:"super-admin"})}));
  }));

  it("rejects malformed assignment requests before the service",async()=>withServer(async(baseUrl)=>{
    const response=await request(baseUrl,"/api/assignments","POST",{reportId:"RPT-1",assigneeEmail:"invalid",reason:"Assign"});
    expect(response.status).toBe(400); expect(service.create).not.toHaveBeenCalled();
  }));

  it("returns dependency-cycle conflicts without hiding the reason",async()=>withServer(async(baseUrl)=>{
    service.setTaskDependencies.mockRejectedValueOnce(new Error("Task dependency would create a cycle"));
    const response=await request(baseUrl,"/api/assignments/assignment-1/tasks/11111111-1111-4111-8111-111111111111/dependencies","PUT",{dependsOnTaskIds:["22222222-2222-4222-8222-222222222222"],reason:"Sequence work"});
    expect(response.status).toBe(409); expect(response.body.error).toContain("cycle");
  }));

  it("exposes event-chain and signature verification",async()=>withServer(async(baseUrl)=>{
    const audit=await request(baseUrl,"/api/assignments/assignment-1/audit-chain/verify");
    const signatures=await request(baseUrl,"/api/assignments/assignment-1/signatures/verify");
    expect(audit).toEqual({status:200,body:{data:expect.objectContaining({valid:true,verifiedEvents:4})}});
    expect(signatures).toEqual({status:200,body:{data:expect.objectContaining({valid:true,configured:true})}});
  }));
});
