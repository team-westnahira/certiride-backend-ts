import  admin from "firebase-admin";
const firebaseServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')

admin.initializeApp({
  credential: admin.credential.cert(firebaseServiceAccount as admin.ServiceAccount),
});


export default admin
