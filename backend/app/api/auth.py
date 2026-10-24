from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.models.setting import Setting
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookie(response: Response, token: str):
    """Sets a secure HttpOnly cookie containing the JWT token."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,   # Inaccessible to JS - protects against XSS token theft
        secure=False,    # Set to True when deploying to HTTPS in production
        samesite="lax",  # Protects against Cross-Site Request Forgery (CSRF)
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, response: Response, db: Session = Depends(get_db)):
    """
    Register a new user account.
    Hashes password with bcrypt, creates default settings, and issues a session cookie.
    """
    # 1. Check if email is already taken
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # 2. Hash password & create user
    hashed = hash_password(user_in.password)
    user = User(email=user_in.email, hashed_password=hashed)
    db.add(user)
    db.flush()  # Flush to populate user.id

    # 3. Create default settings for this user
    default_setting = Setting(
        user_id=user.id,
        timezone="UTC",
        plan_reminder_time="08:00",
        journal_reminder_time="21:00",
        allow_ai_journal_review=False
    )
    db.add(default_setting)
    db.commit()
    db.refresh(user)

    # 4. Generate JWT token
    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    _set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
def login(user_in: UserLogin, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate an existing user.
    Verifies the bcrypt password hash, sets httpOnly cookie, and returns user details.
    """
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    _set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
def logout(response: Response):
    """
    Logs out the user by clearing the httpOnly cookie.
    """
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile.
    """
    return current_user
