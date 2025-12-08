# network_api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, NodeViewSet, PipeViewSet

# Создаем роутер
router = DefaultRouter()

# Регистрируем наши ViewSet'ы
# Это создаст пути: 
# /projects/
# /nodes/
# /pipes/
router.register(r'projects', ProjectViewSet)
router.register(r'nodes', NodeViewSet)
router.register(r'pipes', PipeViewSet)

# Подключаем все URLы, которые сгенерировал роутер
urlpatterns = [
    path('', include(router.urls)),
]