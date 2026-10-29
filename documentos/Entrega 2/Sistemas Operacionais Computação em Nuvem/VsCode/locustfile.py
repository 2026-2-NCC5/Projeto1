from locust import HttpUser, task, between
import random

class SisaAPIUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def test_predict(self):
        payload = {
            "frequencia": round(random.uniform(0.5, 1.0), 2),
            "nota_media": round(random.uniform(4.0, 10.0), 1),
            "atraso_mensalidade": random.randint(0, 3),
            "distancia_km": round(random.uniform(1.0, 30.0), 1),
            "participacao_atividades": round(random.uniform(0.0, 1.0), 2),
            "semestre": random.randint(1, 8),
            "idade": random.randint(18, 35),
            "bolsa": random.choice([0, 1])
        }
        
        self.client.post("/predict", json=payload)