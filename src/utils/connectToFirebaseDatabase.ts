import { initializeApp } from 'firebase/app'
import { Database, getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyB-OiDnVtOZCAssXSKJd7ucV79PuPj5DRk',
  authDomain: 'lyra-finance.firebaseapp.com',
  databaseURL: 'https://lyra-finance-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'lyra-finance',
  storageBucket: 'lyra-finance.appspot.com',
  messagingSenderId: '295284938064',
  appId: '1:295284938064:web:6d2b17d5e82df4c0584855',
}

export default function connectToFirebaseDatabase(): Database {
  const app = initializeApp(firebaseConfig)
  const db = getDatabase(app)
  return db
}
