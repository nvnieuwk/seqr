# Generated by Django 3.2.16 on 2023-02-16 15:32

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('seqr', '0048_phenotypeprioritization'),
    ]

    operations = [
        migrations.AddField(
            model_name='family',
            name='mondo_id',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
    ]
