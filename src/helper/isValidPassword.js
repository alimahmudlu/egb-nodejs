import bcrypt from "bcryptjs";

const isValidPassword = (password, password2) => {
    return bcrypt.compareSync(password, password2);
};

export default isValidPassword;