import Bluebird from 'bluebird';
import mongoose from 'mongoose';

export async function loadMongoose() {
    const connect = await mongoose.connect(process.env.DB_CONNECTION_STRING);
    const connection = connect.connection;
    connection.on(
        'error',
        // eslint-disable-next-line
        console.error.bind(console, 'MongoDB connection error: ')
    );

    mongoose.Promise = Bluebird;

    return connection;
}
