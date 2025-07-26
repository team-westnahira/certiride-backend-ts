import admin from '../config/firebase'
import prisma from '../config/prisma';

// export const sendPushNotification = async (token: string, title: string, body: string) => {
//   const message = {
//     notification: {
//       title,
//       body,
//     },
//     token,
//   };

//   try {
//     const response = await admin.messaging().send(message);
//     console.log("Successfully sent message:", response);
//     return response;
//   } catch (error) {
//     console.error("Error sending message:", error);
//     throw error;
//   }
// };

export const createNotificationRecord = async (type:string , userId:number , userRole:string , content:string) => {
  try{
    await prisma.notification.create({
      data: {
        notificationType:type,
        userId,
        userRole,
        content,
        date: new Date(),
        read: false
      }
    })

    return true
  }catch(err){
    console.log('error is  -> ' , err)
    return false

  }
}
