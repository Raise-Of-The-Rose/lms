import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export type Role = 'ADMIN' | 'TRAINER' | 'STUDENT';

interface AuthUser {
    uid: string;
    email: string | null;
    role: Role | null;
}

interface AuthContextType {
    currentUser: AuthUser | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                // Fetch the custom role from Firestore
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                let role: Role = 'STUDENT'; // Default fallback
                if (userDoc.exists() && userDoc.data().role) {
                    role = userDoc.data().role as Role;
                }

                setCurrentUser({
                    uid: user.uid,
                    email: user.email,
                    role: role,
                });
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);