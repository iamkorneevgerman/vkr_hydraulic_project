from django.contrib.gis import admin
from .models import Project, Node, Pipe

admin.site.register(Project)
admin.site.register(Node, admin.GISModelAdmin)  # Используем GISModelAdmin
admin.site.register(Pipe, admin.GISModelAdmin)