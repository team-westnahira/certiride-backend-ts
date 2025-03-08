import prisma from "../config/prisma";

export const addAuditLog = async (userId:number , eventType: string , content:string) => {

  const recode = await prisma.auditLog.create({
    data: {
      date :  new Date(),
      userId:  userId,
      eventType: eventType,
      content:   content
    },
  });

}