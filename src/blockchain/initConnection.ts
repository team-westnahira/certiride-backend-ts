import { Gateway, Wallets } from 'fabric-network';
import FabricCAServices from 'fabric-ca-client';
import path from 'path';
import fs from 'fs';


export async function testConnection() {
    try {
        const ccpPath = path.resolve(__dirname, '../config/connection-org1.json');
        console.log("ccpPath: " + ccpPath);

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url);

        const walletPath = path.join(__dirname, 'wallet');
        console.log("walletPath: " + walletPath);

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const adminIdentity = await wallet.get('admin');
        if (adminIdentity) {
            console.log('Admin identity already exists in the wallet');
            return;
        }

        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw',
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        await wallet.put('admin', x509Identity);
        console.log('Successfully enrolled admin and stored in wallet');
        
    } catch (error) {
        console.error(`Failed to enroll admin: ${error}`);
    }
}



export async function queryVehicle(VIN: string) {
    // Wallet Path
    const walletPath = path.join(__dirname, 'wallet');
    console.log("wallet path : ", walletPath);
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Connection Profile Path
    const ccpPath = path.resolve(__dirname, '../config/connection-org1.json');
    console.log("connection path : ", ccpPath);
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const identity = await wallet.get('admin');

    if (!identity) {
        console.error('No identity found in the wallet. Register and enroll first.');
        return null;
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'admin',
        discovery: { enabled: true, asLocalhost: false }
    });


    const network = await gateway.getNetwork('mychannel'); 
    const contract = network.getContract('basic');

    try {
        const result = await contract.evaluateTransaction('GetVehicle', VIN);
        console.log(`Query result: ${result.toString()}`);
        return result.toString();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        return null;
    } finally {
        await gateway.disconnect();
    }
}

