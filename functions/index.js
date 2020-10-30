const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp();

admin.firestore().settings({ ignoreUndefinedProperties: true })

exports.addMeasure = functions.https.onRequest(async (request, response) => {
    const { query } = request
    if (!query) {
        response.json({ success: false, error: 'No query defined' })
        return
    }
    const { token, sensor, value } = query
    if (!token || !sensor || !value) {
        response.json({ success: false, error: 'Invalid arguments' })
        return
    }
    const deviceSnapshot = await admin.firestore().collection('devices').where('token', '==', token).get()
    const device = !deviceSnapshot.empty && deviceSnapshot.docs[0]
    if (!device) {
        response.json({ success: false, error: 'Device token is invalid' })
        return
    }
    const sensorSnapshot = await admin.firestore().collection('sensors').where('name', '==', sensor).get()
    const firestoreSensor = !sensorSnapshot.empty && sensorSnapshot.docs[0]
    if (!firestoreSensor) {
        response.json({ success: false, error: 'Sensor does not exist' })
        return
    }
    await admin.firestore().collection('measures').add({
        sensor: firestoreSensor.id,
        device: device.id,
        value,
        date: admin.firestore.Timestamp.now()
    })
    response.json({ success: true })
})

exports.updateLastMeasure = functions.firestore.document('/measures/{measureId}').onCreate(async (snap) => {
    const { sensor, device, value, date } = snap.data()

    const lastMeasureSnapshot = await admin.firestore().collection('last_measures').where('device', '==', device).where('sensor', '==', sensor).get()
    const lastMeasure = !lastMeasureSnapshot.empty && lastMeasureSnapshot.docs[0]
    if (lastMeasure) {
        await admin.firestore().collection('last_measures').doc(`${lastMeasure.id}`).set({
            sensor,
            device,
            value,
            date
        })
    } else {
        await admin.firestore().collection('last_measures').add({
            sensor,
            device,
            value,
            date
        })
    }    
    return true
});

exports.updateUserDevices = functions.firestore.document('/devices/{deviceId}').onCreate(async (snap, context) => {
    const { createdBy } = snap.data()

    const userSnap = await admin.firestore().collection('users').doc(createdBy).get()
    if (userSnap.exists) {
        await admin.firestore().collection('users').doc(createdBy).update({
            devices: admin.firestore.FieldValue.arrayUnion(context.params.deviceId)
        })
    }
    
    return true
});
