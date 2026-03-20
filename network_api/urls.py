from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import ProjectViewSet, NodeViewSet, PipeViewSet, RegisterView

# Создаем роутер
router = DefaultRouter()

# Регистрируем ViewSet'ы
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'nodes', NodeViewSet, basename='node')
router.register(r'pipes', PipeViewSet, basename='pipe')

# Подключаем URL'ы
urlpatterns = [
    # === АВТОРИЗАЦИЯ ===
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', RegisterView.as_view(), name='auth_register'),

    # === СТАРЫЕ URL ===
    path('', include(router.urls)),
]