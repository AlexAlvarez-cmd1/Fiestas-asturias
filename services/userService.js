import {
  doc, getDoc, setDoc, updateDoc, collection,
  query, where, getDocs, orderBy, limit,
  serverTimestamp, deleteDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const friendshipId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export const userService = {
  async getProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async updateProfile(uid, data) {
    await updateDoc(doc(db, 'users', uid), data);
  },

  async updateAsistencia(uid, fiestaId, attending) {
    await updateDoc(doc(db, 'users', uid), {
      asistencias: attending ? arrayUnion(fiestaId) : arrayRemove(fiestaId),
    });
  },

  async searchByUsername(usernameQuery) {
    const q = query(
      collection(db, 'users'),
      where('username', '>=', usernameQuery),
      where('username', '<=', usernameQuery + ''),
      limit(10)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  // --- AMIGOS ---

  async sendFriendRequest(fromUid, toUid) {
    const id = friendshipId(fromUid, toUid);
    await setDoc(doc(db, 'friendships', id), {
      users: [fromUid, toUid],
      status: 'pending',
      requestedBy: fromUid,
      createdAt: serverTimestamp(),
    });
  },

  async acceptFriendRequest(myUid, otherUid) {
    const id = friendshipId(myUid, otherUid);
    await updateDoc(doc(db, 'friendships', id), { status: 'accepted' });
  },

  async rejectFriendRequest(myUid, otherUid) {
    const id = friendshipId(myUid, otherUid);
    await deleteDoc(doc(db, 'friendships', id));
  },

  async removeFriend(myUid, otherUid) {
    const id = friendshipId(myUid, otherUid);
    await deleteDoc(doc(db, 'friendships', id));
  },

  async getFriendship(myUid, otherUid) {
    const id = friendshipId(myUid, otherUid);
    const snap = await getDoc(doc(db, 'friendships', id));
    return snap.exists() ? snap.data() : null;
  },

  async getFriends(uid) {
    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', uid),
      where('status', '==', 'accepted')
    );
    const snap = await getDocs(q);
    const friendUids = snap.docs.map(d => {
      const data = d.data();
      return data.users.find(u => u !== uid);
    });
    const profiles = await Promise.all(friendUids.map(uid => userService.getProfile(uid)));
    return profiles.filter(Boolean);
  },

  async getPendingRequests(uid) {
    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', uid),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const received = snap.docs
      .map(d => d.data())
      .filter(d => d.requestedBy !== uid);

    const enriched = await Promise.all(
      received.map(async (req) => {
        const profile = await userService.getProfile(req.requestedBy);
        return { ...req, requesterProfile: profile };
      })
    );
    return enriched;
  },
};
