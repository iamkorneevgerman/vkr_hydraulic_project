# network_api/views.py

# ... (твои импорты)
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Project, Node, Pipe
from .serializers import ProjectSerializer, NodeSerializer, PipeSerializer
from .services import HydraulicSolver

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer

    # ... (стандартный код ViewSet) ...

    # === ОБНОВЛЕННЫЙ ЭНДПОИНТ ДЛЯ РАСЧЕТА ===
    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """
        Запуск гидравлического расчета.
        URL: POST /api/projects/{id}/calculate/
        Возвращает: JSON с обновленными данными узлов и труб.
        """
        project = self.get_object() # Получаем текущий проект
        
        # 1. Запускаем математику (наш сервис)
        solver = HydraulicSolver(project.id)
        
        try:
            result = solver.solve() # Магия происходит здесь
            
            if result['success']:
                # 2. Если расчет прошел успешно, нам нужно вернуть СВЕЖИЕ данные.
                # Мы заново достаем узлы и трубы из БД, так как сервис их обновил.
                nodes = Node.objects.filter(project=project)
                pipes = Pipe.objects.filter(project=project)

                # 3. Превращаем объекты Python в JSON (сериализация)
                nodes_data = NodeSerializer(nodes, many=True).data
                pipes_data = PipeSerializer(pipes, many=True).data

                # 4. Формируем красивый ответ
                return Response({
                    "status": "success",
                    "message": result["message"],
                    "data": {
                        "nodes": nodes_data,
                        "pipes": pipes_data
                    }
                }, status=200)
            
            else:
                # Если математика не сошлась
                return Response({
                    "status": "error",
                    "message": result["message"]
                }, status=400)

        except ValueError as e:
            # Ошибки валидации данных (например, нет узлов)
            return Response({'status': 'error', 'message': str(e)}, status=400)
        except Exception as e:
            # Любые другие непредвиденные ошибки
            return Response({'status': 'error', 'message': f"Internal error: {str(e)}"}, status=500)


# ViewSet для Узлов
class NodeViewSet(viewsets.ModelViewSet):
    queryset = Node.objects.all()
    serializer_class = NodeSerializer
    
    # Опционально: можно добавить фильтрацию, чтобы получать узлы конкретного проекта
    # Например: /api/nodes/?project=1
    filterset_fields = ['project'] 

# ViewSet для Труб
class PipeViewSet(viewsets.ModelViewSet):
    queryset = Pipe.objects.all()
    serializer_class = PipeSerializer
    filterset_fields = ['project']
