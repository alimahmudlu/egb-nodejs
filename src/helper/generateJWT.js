import jwt from 'jsonwebtoken';

const generateJWT = user => {
    return jwt.sign(
        user,
        'N6Lh7zgafuGO72FVaLJYbfygDq6nFAQq'
    );
};

export default generateJWT;