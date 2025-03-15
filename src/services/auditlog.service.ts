import prisma from "../config/prisma";

export const addAuditLog = async (userId:number , eventType: string , content:string) => {

  try{
    await prisma.auditLog.create({
      data: {
        date :  new Date(),
        userId:  userId,
        eventType: eventType,
        content:   content
      },
    });
  
    return true
  }catch(err){
    console.log(err)
    return false
  }
  
}