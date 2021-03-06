/* globals localStorage */
import { AUTH_LOGIN, AUTH_LOGOUT, AUTH_CHECK } from 'react-admin';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';

const baseConfig = {
  userProfilePath: '/users/',
  userAdminProp: 'isAdmin',
  localStorageTokenName: 'RAFirebaseClientToken',
  handleAuthStateChange: async (auth, config) => {
    if (auth) {
      const snapshot = await firebase
        .firestore()
        .doc(config.userProfilePath + auth.user.uid)
        .get();
      const profile = snapshot.data();

      if (profile && profile[config.userAdminProp]) {
        const firebaseToken = auth.user.getIdToken();
        let user = { auth, profile, firebaseToken };
        localStorage.setItem(config.localStorageTokenName, firebaseToken);
        return user;
      } else {
        firebase.auth().signOut();
        localStorage.removeItem(config.localStorageTokenName);
        throw new Error('sign_in_error');
      }
    } else {
      localStorage.removeItem(config.localStorageTokenName);
      throw new Error('sign_in_error');
    }
  }
};

export default (config = {}) => {
  config = { ...baseConfig, ...config };

  const firebaseLoaded = () =>
    new Promise(resolve => {
      firebase.auth().onAuthStateChanged(resolve);
    });

  return async (type, params) => {
    if (type === AUTH_LOGOUT) {
      config.handleAuthStateChange(null, config).catch(() => {});
      return firebase.auth().signOut();
    }

    if (firebase.auth().currentUser) {
      await firebase.auth().currentUser.reload();
    }

    if (type === AUTH_CHECK) {
      await firebaseLoaded();

      if (!firebase.auth().currentUser) {
        throw new Error('sign_in_error');
      }

      return true;
    }

    if (type === AUTH_LOGIN) {
      const { username, password, alreadySignedIn } = params;
      let auth = firebase.auth().currentUser;

      if (!auth || !alreadySignedIn) {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        auth = await firebase.auth().signInWithEmailAndPassword(username, password);
      }

      return config.handleAuthStateChange(auth, config);
    }

    return false;
  };
};
