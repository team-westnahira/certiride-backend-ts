import admin from '../config/firebase'

export const sendPushNotification = async (token: string, title: string, body: string) => {
  const message = {
    notification: {
      title,
      body,
    },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};
